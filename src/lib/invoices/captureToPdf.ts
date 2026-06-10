import { jsPDF } from 'jspdf';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebase/app';
import type { Invoice } from '../../types/models';
import { isoToday } from '../dates';

const MAX_DIMENSION = 2200; // limita o tamanho da imagem para PDFs razoáveis

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.src = url;
    });
    return img;
  } finally {
    // revogado depois de desenhar no canvas (o browser mantém a imagem em memória)
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Converte uma fotografia (jpeg/png/webp) num PDF A4 com a imagem embebida. */
export async function imageToPdf(file: File): Promise<Blob> {
  const img = await fileToImage(file);

  let { width, height } = img;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);

  const orientation = width > height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const fit = Math.min((pageW - 2 * margin) / width, (pageH - 2 * margin) / height);
  const w = width * fit;
  const h = height * fit;
  pdf.addImage(jpegDataUrl, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h);
  return pdf.output('blob');
}

export interface UploadedInvoiceFile {
  storagePath: string;
  invoiceId: string;
}

/**
 * Prepara e carrega o documento da fatura para o Storage:
 * imagens são convertidas para PDF; PDFs são carregados tal e qual.
 */
export async function uploadInvoiceFile(uid: string, file: File): Promise<UploadedInvoiceFile> {
  let pdfBlob: Blob;
  if (file.type === 'application/pdf') {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('O PDF excede 10 MB.');
    }
    pdfBlob = file;
  } else if (file.type.startsWith('image/')) {
    pdfBlob = await imageToPdf(file);
  } else {
    throw new Error('Formato não suportado. Use uma fotografia ou um PDF.');
  }

  const invoiceId = crypto.randomUUID();
  const storagePath = `users/${uid}/invoices/${invoiceId}.pdf`;
  await uploadBytes(storageRef(storage, storagePath), pdfBlob, {
    contentType: 'application/pdf',
  });
  return { storagePath, invoiceId };
}

/** Documento de fatura inicial (antes da extração por IA). */
export function newInvoiceDoc(invoiceId: string, storagePath: string): Invoice {
  return {
    id: invoiceId,
    direction: 'payable',
    counterparty: '',
    issueDate: isoToday(),
    descriptionSummary: '',
    netCents: 0,
    vatCents: 0,
    grossCents: 0,
    categoryId: 'outros-gastos',
    status: 'uploaded',
    storagePath,
    createdAt: new Date().toISOString(),
  };
}
