import { useMemo, useState } from 'react';
import { useAuth } from '../store/useAuth';
import { useTransactions } from '../store/useTransactions';
import type { Transaction } from '../types/models';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { MoneyText } from '../components/ui/MoneyText';
import { Select, TextInput } from '../components/ui/Field';
import { CsvImportWizard } from '../components/transactions/CsvImportWizard';
import { SaftImportModal } from '../components/transactions/SaftImportModal';
import { AddTransactionModal } from '../components/transactions/AddTransactionModal';
import { CATEGORIES } from '../lib/categories/categories';
import { normalizeText } from '../lib/categories/autoCategorize';
import { monthKey, monthLabelPt, formatDatePt } from '../lib/dates';
import { toast } from '../components/ui/Toast';

const SOURCE_LABEL: Record<Transaction['source'], string> = {
  csv: 'extrato',
  saft: 'SAF-T',
  manual: 'manual',
};

export default function TransactionsPage() {
  const uid = useAuth((s) => s.user!.uid);
  const { transactions, addMany, updateCategory, remove } = useTransactions();

  const [csvOpen, setCsvOpen] = useState(false);
  const [saftOpen, setSaftOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.date)));
    return [...set].sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return transactions.filter((t) => {
      if (month && monthKey(t.date) !== month) return false;
      if (category && t.categoryId !== category) return false;
      if (q && !normalizeText(`${t.description} ${t.counterparty ?? ''}`).includes(q)) return false;
      return true;
    });
  }, [transactions, month, category, query]);

  const total = filtered.reduce((s, t) => s + t.amountCents, 0);

  const onImport = (txs: Omit<Transaction, 'id'>[]) => addMany(uid, txs);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Movimentos</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAddOpen(true)}>+ Manual</Button>
          <Button variant="secondary" onClick={() => setSaftOpen(true)}>Importar SAF-T</Button>
          <Button onClick={() => setCsvOpen(true)}>Importar CSV</Button>
        </div>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Todos os meses</option>
              {months.map((m) => (
                <option key={m} value={m}>{monthLabelPt(m)}</option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-44 flex-1">
            <TextInput placeholder="Pesquisar descrição…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="ml-auto text-sm text-slate-500">
            {filtered.length} mov. · saldo <MoneyText cents={total} signed />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="🏦"
            title={transactions.length === 0 ? 'Ainda sem movimentos' : 'Nenhum movimento corresponde aos filtros'}
            hint={
              transactions.length === 0
                ? 'Importe o extrato bancário em CSV ou o SAF-T da faturação para começar.'
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Descrição</th>
                  <th className="px-2 py-2">Categoria</th>
                  <th className="px-2 py-2">Origem</th>
                  <th className="px-2 py-2 text-right">Montante</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-2 whitespace-nowrap">{formatDatePt(t.date)}</td>
                    <td className="max-w-72 px-2 py-2">
                      <div className="truncate">{t.description}</div>
                      {t.counterparty && <div className="truncate text-xs text-slate-400">{t.counterparty}</div>}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={t.categoryId}
                        onChange={(e) => {
                          void updateCategory(uid, t.id, e.target.value).catch(() =>
                            toast('error', 'Não foi possível alterar a categoria.'),
                          );
                        }}
                        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-slate-300"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={t.source === 'saft' ? 'brand' : 'neutral'}>{SOURCE_LABEL[t.source]}</Badge>
                      {t.reconciledInvoiceId && <Badge tone="success">conciliado</Badge>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <MoneyText cents={t.amountCents} signed />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm('Apagar este movimento?')) {
                            void remove(uid, t.id).catch(() => toast('error', 'Não foi possível apagar.'));
                          }
                        }}
                        className="text-xs text-slate-300 hover:text-red-600"
                        aria-label="Apagar"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 300 && (
              <p className="mt-2 text-center text-xs text-slate-400">
                A mostrar os primeiros 300 — refine os filtros para ver mais.
              </p>
            )}
          </div>
        )}
      </Card>

      <CsvImportWizard open={csvOpen} onClose={() => setCsvOpen(false)} onImport={onImport} />
      <SaftImportModal open={saftOpen} onClose={() => setSaftOpen(false)} onImport={onImport} />
      <AddTransactionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={async (tx) => {
          await addMany(uid, [tx]);
        }}
      />
    </div>
  );
}
