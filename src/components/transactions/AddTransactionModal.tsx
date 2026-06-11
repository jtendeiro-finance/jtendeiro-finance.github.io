import { useState, type FormEvent } from 'react';
import type { Transaction } from '../../types/models';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Labeled, Select, TextInput } from '../ui/Field';
import { CATEGORIES } from '../../lib/categories/categories';
import { parsePtAmountToCents } from '../../lib/money';
import { isoToday } from '../../lib/dates';
import { toast } from '../ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (tx: Omit<Transaction, 'id'>) => Promise<void>;
}

export function AddTransactionModal({ open, onClose, onAdd }: Props) {
  const [date, setDate] = useState(isoToday());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState('outros-gastos');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parsePtAmountToCents(amount);
    if (cents == null || cents === 0) {
      toast('error', 'Montante inválido.');
      return;
    }
    setBusy(true);
    try {
      await onAdd({
        date,
        description: description.trim() || '(sem descrição)',
        amountCents: kind === 'expense' ? -Math.abs(cents) : Math.abs(cents),
        categoryId,
        source: 'manual',
        importedAt: new Date().toISOString(),
      });
      toast('success', 'Movimento registado.');
      setDescription('');
      setAmount('');
      onClose();
    } catch {
      toast('error', 'Não foi possível registar o movimento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Adicionar movimento">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Data">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Labeled>
          <Labeled label="Tipo">
            <Select
              value={kind}
              onChange={(e) => {
                const k = e.target.value as 'income' | 'expense';
                setKind(k);
                setCategoryId(k === 'income' ? 'outros-rendimentos' : 'outros-gastos');
              }}
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </Select>
          </Labeled>
        </div>
        <Labeled label="Descrição">
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Renda do espaço" />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Montante (€)">
            <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="123,45" required />
          </Labeled>
          <Labeled label="Categoria">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {CATEGORIES.filter((c) => c.kind === kind).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          </Labeled>
        </div>
        <div className="mt-2 flex justify-end">
          <Button type="submit" busy={busy}>Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}
