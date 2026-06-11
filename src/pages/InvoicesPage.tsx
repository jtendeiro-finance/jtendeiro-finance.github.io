import { useState } from 'react';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { storage } from '../firebase/app';
import { useAuth } from '../store/useAuth';
import { useInvoices } from '../store/useInvoices';
import { useTransactions } from '../store/useTransactions';
import type { Invoice, InvoiceStatus } from '../types/models';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { MoneyText } from '../components/ui/MoneyText';
import { InvoiceCapture } from '../components/invoices/InvoiceCapture';
import { InvoiceReviewModal } from '../components/invoices/InvoiceReviewModal';
import { requestInvoiceProcessing } from '../lib/ai/callables';
import { formatDatePt } from '../lib/dates';
import { categoryLabel } from '../lib/categories/categories';
import { toast } from '../components/ui/Toast';

const STATUS_META: Record<InvoiceStatus, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'brand' }> = {
  uploaded: { label: 'carregada', tone: 'neutral' },
  processing: { label: 'a processar…', tone: 'info' },
  extracted: { label: 'rever dados', tone: 'warning' },
  confirmed: { label: 'confirmada', tone: 'brand' },
  paid: { label: 'paga', tone: 'success' },
  reconciled: { label: 'conciliada', tone: 'success' },
};

export default function InvoicesPage() {
  const uid = useAuth((s) => s.user!.uid);
  const { invoices, update, remove } = useInvoices();
  const addTransactions = useTransactions((s) => s.addMany);
  const [reviewing, setReviewing] = useState<Invoice | null>(null);

  const openPdf = async (inv: Invoice) => {
    try {
      const url = await getDownloadURL(storageRef(storage, inv.storagePath));
      window.open(url, '_blank', 'noopener');
    } catch {
      toast('error', 'Não foi possível abrir o documento.');
    }
  };

  const retryExtraction = async (inv: Invoice) => {
    try {
      await update(uid, inv.id, { status: 'processing' });
      await requestInvoiceProcessing(inv.id);
    } catch (e) {
      await update(uid, inv.id, { status: 'uploaded' });
      toast('error', (e as Error).message);
    }
  };

  const confirmAsTransaction = async (inv: Invoice) => {
    const sign = inv.direction === 'payable' ? -1 : 1;
    await addTransactions(uid, [
      {
        date: inv.issueDate,
        description: `Fatura ${inv.number ?? ''} — ${inv.counterparty}`.trim(),
        amountCents: sign * Math.abs(inv.grossCents),
        categoryId: inv.categoryId,
        source: 'manual',
        counterparty: inv.counterparty,
        vatCents: inv.vatCents,
        docRef: inv.number,
        importedAt: new Date().toISOString(),
      },
    ]);
  };

  const sorted = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Faturas</h1>
        <InvoiceCapture />
      </div>

      <Card>
        {sorted.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="Ainda sem faturas digitalizadas"
            hint="Fotografe uma fatura com o telemóvel ou carregue uma imagem/PDF. A IA extrai automaticamente o fornecedor, os montantes e o IVA."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {sorted.map((inv) => {
              const meta = STATUS_META[inv.status];
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 py-3">
                  <button onClick={() => void openPdf(inv)} className="text-2xl" title="Abrir PDF">
                    📄
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {inv.counterparty || 'Fatura sem dados'}
                      {inv.number && <span className="ml-1 text-xs text-slate-400">#{inv.number}</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {formatDatePt(inv.issueDate)}
                      {inv.dueDate && ` · vence ${formatDatePt(inv.dueDate)}`}
                      {' · '}
                      {categoryLabel(inv.categoryId)}
                    </p>
                  </div>
                  <Badge tone={inv.direction === 'payable' ? 'warning' : 'success'}>
                    {inv.direction === 'payable' ? 'a pagar' : 'a receber'}
                  </Badge>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="w-24 text-right text-sm font-semibold">
                    {inv.grossCents > 0 ? <MoneyText cents={inv.grossCents} /> : '—'}
                  </span>
                  <div className="flex gap-1">
                    {(inv.status === 'extracted' || inv.status === 'confirmed') && (
                      <button
                        onClick={() => setReviewing(inv)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {inv.status === 'extracted' ? 'Rever' : 'Editar'}
                      </button>
                    )}
                    {inv.status === 'uploaded' && (
                      <button
                        onClick={() => void retryExtraction(inv)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Extrair com IA
                      </button>
                    )}
                    {(inv.status === 'confirmed' || inv.status === 'extracted') && (
                      <button
                        onClick={() => void update(uid, inv.id, { status: 'paid' })}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        title="Marcar como paga"
                      >
                        ✓ Paga
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Apagar esta fatura e o respetivo documento?')) {
                          void remove(uid, inv).catch(() => toast('error', 'Não foi possível apagar.'));
                        }
                      }}
                      className="rounded px-2 py-1 text-xs text-slate-300 hover:text-red-600"
                      aria-label="Apagar"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <InvoiceReviewModal
        invoice={reviewing}
        onClose={() => setReviewing(null)}
        onSave={(patch) => update(uid, reviewing!.id, patch)}
        onConfirmAsTransaction={confirmAsTransaction}
      />
    </div>
  );
}
