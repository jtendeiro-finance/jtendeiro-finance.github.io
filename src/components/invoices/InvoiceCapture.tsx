import { useState } from 'react';
import { useAuth } from '../../store/useAuth';
import { useInvoices } from '../../store/useInvoices';
import { uploadInvoiceFile, newInvoiceDoc } from '../../lib/invoices/captureToPdf';
import { requestInvoiceProcessing } from '../../lib/ai/callables';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

/**
 * Captura de faturas: fotografia (câmara, em telemóvel) ou ficheiro (imagem/PDF).
 * O documento é convertido para PDF, guardado no Storage e enviado para extração por IA.
 */
export function InvoiceCapture() {
  const uid = useAuth((s) => s.user!.uid);
  const { create, update } = useInvoices();
  const [busy, setBusy] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const { invoiceId, storagePath } = await uploadInvoiceFile(uid, file);
      await create(uid, newInvoiceDoc(invoiceId, storagePath));
      toast('success', 'Fatura carregada. A extrair dados com IA…');
      await update(uid, invoiceId, { status: 'processing' });
      try {
        await requestInvoiceProcessing(invoiceId);
      } catch (e) {
        await update(uid, invoiceId, { status: 'uploaded' });
        toast('error', (e as Error).message);
      }
    } catch (e) {
      toast('error', (e as Error).message || 'Não foi possível carregar a fatura.');
    } finally {
      setBusy(false);
    }
  };

  const input = (accept: string, capture?: 'environment') => (
    <input
      type="file"
      accept={accept}
      {...(capture ? { capture } : {})}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void handle(f);
        e.target.value = '';
      }}
    />
  );

  return (
    <div className="flex flex-wrap gap-2">
      <label>
        <span className="sr-only">Fotografar fatura</span>
        <Button busy={busy} onClick={(e) => (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)?.click()}>
          📷 Fotografar fatura
        </Button>
        {input('image/*', 'environment')}
      </label>
      <label>
        <span className="sr-only">Carregar ficheiro</span>
        <Button
          variant="secondary"
          busy={busy}
          onClick={(e) => (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)?.click()}
        >
          Carregar imagem/PDF
        </Button>
        {input('image/*,application/pdf')}
      </label>
    </div>
  );
}
