import { useState } from 'react';
import { useAuth } from '../../store/useAuth';
import { useInvoices } from '../../store/useInvoices';
import { uploadInvoiceFile, newInvoiceDoc } from '../../lib/invoices/captureToPdf';
import { requestInvoiceProcessing } from '../../lib/ai/callables';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

/** Máximo de faturas por seleção (o limite diário de extrações por IA é 20). */
const MAX_FILES = 10;

/**
 * Captura de faturas: fotografia (câmara, em telemóvel) ou ficheiros (imagem/PDF,
 * até 10 de uma vez). Cada documento é convertido para PDF, guardado no Storage
 * e enviado para extração por IA.
 */
export function InvoiceCapture() {
  const uid = useAuth((s) => s.user!.uid);
  const { create, update } = useInvoices();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleOne = async (file: File): Promise<boolean> => {
    const { invoiceId, storagePath } = await uploadInvoiceFile(uid, file);
    await create(uid, newInvoiceDoc(invoiceId, storagePath));
    await update(uid, invoiceId, { status: 'processing' });
    try {
      await requestInvoiceProcessing(invoiceId);
      return true;
    } catch (e) {
      await update(uid, invoiceId, { status: 'uploaded' });
      toast('error', `${file.name}: ${(e as Error).message}`);
      return false;
    }
  };

  const handle = async (files: File[]) => {
    if (files.length > MAX_FILES) {
      toast('error', `Selecione no máximo ${MAX_FILES} faturas de uma vez.`);
      files = files.slice(0, MAX_FILES);
    }
    setBusy(true);
    let ok = 0;
    try {
      for (let i = 0; i < files.length; i += 1) {
        if (files.length > 1) setProgress(`Fatura ${i + 1} de ${files.length}…`);
        try {
          if (await handleOne(files[i])) ok += 1;
        } catch (e) {
          toast('error', `${files[i].name}: ${(e as Error).message || 'não foi possível carregar.'}`);
        }
      }
      if (ok > 0) {
        toast(
          'success',
          ok === 1 ? 'Fatura carregada e enviada para extração por IA.' : `${ok} faturas carregadas e enviadas para extração por IA.`,
        );
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const input = (accept: string, opts?: { capture?: 'environment'; multiple?: boolean }) => (
    <input
      type="file"
      accept={accept}
      {...(opts?.capture ? { capture: opts.capture } : {})}
      {...(opts?.multiple ? { multiple: true } : {})}
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 0) void handle(files);
        e.target.value = '';
      }}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label>
        <span className="sr-only">Fotografar fatura</span>
        <Button busy={busy} onClick={(e) => (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)?.click()}>
          📷 Fotografar fatura
        </Button>
        {input('image/*', { capture: 'environment' })}
      </label>
      <label>
        <span className="sr-only">Carregar ficheiros</span>
        <Button
          variant="secondary"
          busy={busy}
          onClick={(e) => (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)?.click()}
        >
          Carregar imagens/PDF (até {MAX_FILES})
        </Button>
        {input('image/*,application/pdf', { multiple: true })}
      </label>
      {progress && <span className="text-xs text-slate-500">{progress}</span>}
    </div>
  );
}
