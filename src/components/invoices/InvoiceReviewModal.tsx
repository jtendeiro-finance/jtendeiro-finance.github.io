import { useEffect, useState } from 'react';
import type { Invoice, InvoiceDirection } from '../../types/models';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Labeled, Select, TextInput } from '../ui/Field';
import { CATEGORIES } from '../../lib/categories/categories';
import { parsePtAmountToCents, formatCents } from '../../lib/money';
import { toast } from '../ui/Toast';

interface Props {
  invoice: Invoice | null;
  onClose: () => void;
  onSave: (patch: Partial<Invoice>) => Promise<void>;
  onConfirmAsTransaction: (invoice: Invoice) => Promise<void>;
}

/** Revisão dos dados extraídos por IA antes de confirmar a fatura. */
export function InvoiceReviewModal({ invoice, onClose, onSave, onConfirmAsTransaction }: Props) {
  const [counterparty, setCounterparty] = useState('');
  const [nif, setNif] = useState('');
  const [number, setNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [gross, setGross] = useState('');
  const [vat, setVat] = useState('');
  const [direction, setDirection] = useState<InvoiceDirection>('payable');
  const [categoryId, setCategoryId] = useState('outros-gastos');
  const [registerTx, setRegisterTx] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setCounterparty(invoice.counterparty);
    setNif(invoice.nif ?? '');
    setNumber(invoice.number ?? '');
    setIssueDate(invoice.issueDate);
    setDueDate(invoice.dueDate ?? '');
    setDescription(invoice.descriptionSummary);
    setGross((invoice.grossCents / 100).toFixed(2).replace('.', ','));
    setVat((invoice.vatCents / 100).toFixed(2).replace('.', ','));
    setDirection(invoice.direction);
    setCategoryId(invoice.categoryId);
    setRegisterTx(false);
  }, [invoice]);

  if (!invoice) return null;

  const save = async () => {
    const grossCents = parsePtAmountToCents(gross);
    const vatCents = parsePtAmountToCents(vat) ?? 0;
    if (grossCents == null || grossCents <= 0) {
      toast('error', 'Total da fatura inválido.');
      return;
    }
    setBusy(true);
    try {
      const patch: Partial<Invoice> = {
        counterparty: counterparty.trim(),
        nif: nif.trim() || undefined,
        number: number.trim() || undefined,
        issueDate,
        dueDate: dueDate || undefined,
        descriptionSummary: description.trim(),
        grossCents,
        vatCents,
        netCents: grossCents - vatCents,
        direction,
        categoryId,
        status: 'confirmed',
      };
      await onSave(patch);
      if (registerTx) {
        await onConfirmAsTransaction({ ...invoice, ...patch } as Invoice);
      }
      toast('success', 'Fatura confirmada.');
      onClose();
    } catch {
      toast('error', 'Não foi possível guardar a fatura.');
    } finally {
      setBusy(false);
    }
  };

  const confidence = invoice.extractionConfidence;

  return (
    <Modal open onClose={onClose} title="Rever dados da fatura" wide>
      {invoice.status === 'extracted' && confidence != null && (
        <p className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
          Dados extraídos automaticamente por IA (confiança {(confidence * 100).toFixed(0)} %).
          Verifique antes de confirmar.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Labeled label="Tipo">
          <Select value={direction} onChange={(e) => setDirection(e.target.value as InvoiceDirection)}>
            <option value="payable">A pagar (fornecedor)</option>
            <option value="receivable">A receber (cliente)</option>
          </Select>
        </Labeled>
        <Labeled label={direction === 'payable' ? 'Fornecedor' : 'Cliente'}>
          <TextInput value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </Labeled>
        <Labeled label="NIF">
          <TextInput value={nif} onChange={(e) => setNif(e.target.value)} />
        </Labeled>
        <Labeled label="N.º da fatura">
          <TextInput value={number} onChange={(e) => setNumber(e.target.value)} />
        </Labeled>
        <Labeled label="Data de emissão">
          <TextInput type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </Labeled>
        <Labeled label="Vencimento">
          <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Labeled>
        <Labeled label="Total c/ IVA (€)">
          <TextInput value={gross} onChange={(e) => setGross(e.target.value)} />
        </Labeled>
        <Labeled label="IVA (€)">
          <TextInput value={vat} onChange={(e) => setVat(e.target.value)} />
        </Labeled>
        <Labeled label="Categoria">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Select>
        </Labeled>
      </div>
      <div className="mt-3">
        <Labeled label="Descrição">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Labeled>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={registerTx} onChange={(e) => setRegisterTx(e.target.checked)} />
        Registar também como movimento {direction === 'payable' ? 'de despesa' : 'de receita'} (
        {parsePtAmountToCents(gross) != null ? formatCents(parsePtAmountToCents(gross)!) : '—'})
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void save()} busy={busy}>Confirmar fatura</Button>
      </div>
    </Modal>
  );
}
