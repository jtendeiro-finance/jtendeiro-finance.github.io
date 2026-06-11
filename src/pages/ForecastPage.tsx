import { useMemo, useState } from 'react';
import { useAuth } from '../store/useAuth';
import { useDerivedData } from '../lib/useDerivedData';
import { useInvoices } from '../store/useInvoices';
import { useTransactions } from '../store/useTransactions';
import { reconcile } from '../lib/reconciliation/reconcile';
import type { ForecastItemKind, Invoice, Transaction } from '../types/models';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { MoneyText } from '../components/ui/MoneyText';
import { ProjectedBalanceChart } from '../components/charts/ProjectedBalanceChart';
import { formatDatePt } from '../lib/dates';
import { toast } from '../components/ui/Toast';

const KIND_LABEL: Record<ForecastItemKind, string> = {
  invoice: 'Fatura',
  payroll: 'Salários',
  iva: 'IVA',
  tsu: 'Seg. Social',
  retencoes: 'Retenções',
  recurring: 'Recorrente',
};

const KIND_TONE: Record<ForecastItemKind, 'neutral' | 'warning' | 'info' | 'brand' | 'danger'> = {
  invoice: 'warning',
  payroll: 'brand',
  iva: 'danger',
  tsu: 'info',
  retencoes: 'info',
  recurring: 'neutral',
};

function ForecastTab() {
  const { forecast, kpis } = useDerivedData();
  const hasItems = forecast.some((w) => w.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Saldo projetado (8 semanas)">
        <ProjectedBalanceChart weeks={forecast} />
        <p className="mt-1 text-xs text-slate-400">
          Parte do saldo atual ({<MoneyText cents={kpis.cashPositionCents} />}) e desconta faturas a
          pagar, salários, impostos e despesas recorrentes detetadas. Receitas futuras não são consideradas — é uma visão prudente.
        </p>
      </Card>

      {!hasItems ? (
        <Card>
          <EmptyState
            icon="📅"
            title="Sem pagamentos previstos"
            hint="Confirme faturas de fornecedores (com data de vencimento) e preencha a folha salarial no perfil para alimentar a previsão."
          />
        </Card>
      ) : (
        forecast
          .filter((w) => w.items.length > 0)
          .map((w) => (
            <Card
              key={w.weekStart}
              title={`Semana de ${formatDatePt(w.weekStart)}`}
              action={
                <span className="text-sm">
                  Saídas <MoneyText cents={-w.totalOutCents} signed /> · saldo previsto{' '}
                  <strong className={w.projectedBalanceCents < 0 ? 'text-red-700' : ''}>
                    <MoneyText cents={w.projectedBalanceCents} />
                  </strong>
                </span>
              }
            >
              <ul className="flex flex-col divide-y divide-slate-100">
                {w.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <Badge tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="text-xs text-slate-400">{formatDatePt(item.dueDate)}</span>
                    <span className="w-24 text-right font-medium">
                      <MoneyText cents={item.amountCents} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}
    </div>
  );
}

function ReconciliationTab() {
  const uid = useAuth((s) => s.user!.uid);
  const { invoices, update: updateInvoice } = useInvoices();
  const { transactions, setReconciled } = useTransactions();

  const result = useMemo(() => reconcile(transactions, invoices), [transactions, invoices]);

  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);
  const txById = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const [busy, setBusy] = useState(false);

  const applyMatch = async (invoiceId: string, transactionId: string) => {
    setBusy(true);
    try {
      await updateInvoice(uid, invoiceId, { status: 'reconciled', matchedTransactionId: transactionId });
      await setReconciled(uid, transactionId, invoiceId);
      toast('success', 'Fatura conciliada com o movimento bancário.');
    } catch {
      toast('error', 'Não foi possível conciliar.');
    } finally {
      setBusy(false);
    }
  };

  const applyAll = async () => {
    setBusy(true);
    try {
      for (const m of result.autoMatched) {
        await updateInvoice(uid, m.invoiceId, { status: 'reconciled', matchedTransactionId: m.transactionId });
        await setReconciled(uid, m.transactionId, m.invoiceId);
      }
      toast('success', `${result.autoMatched.length} faturas conciliadas automaticamente.`);
    } catch {
      toast('error', 'A conciliação automática falhou a meio. Verifique e repita.');
    } finally {
      setBusy(false);
    }
  };

  const reconciled = invoices.filter((i) => i.status === 'reconciled');

  const InvoiceLine = ({ inv }: { inv: Invoice }) => (
    <span className="min-w-0 flex-1 truncate">
      <strong>{inv.counterparty || 'Fatura'}</strong>
      {inv.number && ` #${inv.number}`} · <MoneyText cents={inv.grossCents} />
      {inv.dueDate && <span className="text-xs text-slate-400"> · vence {formatDatePt(inv.dueDate)}</span>}
    </span>
  );

  const TxLine = ({ tx }: { tx: Transaction }) => (
    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
      {formatDatePt(tx.date)} · {tx.description} · <MoneyText cents={tx.amountCents} signed />
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Relatório resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Conciliadas', value: reconciled.length },
          { label: 'Correspondências automáticas', value: result.autoMatched.length },
          { label: 'Sugestões a confirmar', value: result.suggestions.length },
          { label: 'Faturas sem correspondência', value: result.unmatchedInvoiceIds.length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {result.autoMatched.length > 0 && (
        <Card
          title="Correspondências automáticas"
          action={<Button onClick={() => void applyAll()} busy={busy}>Conciliar todas</Button>}
        >
          <ul className="flex flex-col divide-y divide-slate-100">
            {result.autoMatched.map((m) => {
              const inv = invoiceById.get(m.invoiceId);
              const tx = txById.get(m.transactionId);
              if (!inv || !tx) return null;
              return (
                <li key={m.invoiceId} className="flex flex-col gap-1 py-2 text-sm md:flex-row md:items-center md:gap-3">
                  <InvoiceLine inv={inv} />
                  <span className="text-slate-300">⇄</span>
                  <TxLine tx={tx} />
                  <Badge tone="success">{Math.round(m.score * 100)} %</Badge>
                  <Button variant="secondary" busy={busy} onClick={() => void applyMatch(m.invoiceId, m.transactionId)}>
                    Conciliar
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {result.suggestions.length > 0 && (
        <Card title="Sugestões (confirme manualmente)">
          <ul className="flex flex-col divide-y divide-slate-100">
            {result.suggestions.map((s) => {
              const inv = invoiceById.get(s.invoiceId);
              if (!inv) return null;
              return (
                <li key={s.invoiceId} className="py-3">
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <InvoiceLine inv={inv} />
                  </div>
                  <ul className="ml-4 flex flex-col gap-1">
                    {s.candidates.map((c) => {
                      const tx = txById.get(c.transactionId);
                      if (!tx) return null;
                      return (
                        <li key={c.transactionId} className="flex items-center gap-2">
                          <TxLine tx={tx} />
                          <Badge tone="info">{Math.round(c.score * 100)} %</Badge>
                          <button
                            onClick={() => void applyMatch(s.invoiceId, c.transactionId)}
                            className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
                          >
                            Associar
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {result.unmatchedInvoiceIds.length > 0 && (
        <Card title="Faturas sem movimento bancário correspondente">
          <ul className="flex flex-col divide-y divide-slate-100">
            {result.unmatchedInvoiceIds.map((id) => {
              const inv = invoiceById.get(id);
              if (!inv) return null;
              return (
                <li key={id} className="flex items-center gap-2 py-2 text-sm">
                  <InvoiceLine inv={inv} />
                  <Badge tone={inv.direction === 'payable' ? 'warning' : 'info'}>
                    {inv.direction === 'payable' ? 'por liquidar' : 'por receber'}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {invoices.length === 0 && (
        <Card>
          <EmptyState
            icon="🔄"
            title="Nada para conciliar"
            hint="Digitalize faturas e importe o extrato bancário; a conciliação cruza automaticamente os dois."
          />
        </Card>
      )}
    </div>
  );
}

export default function ForecastPage() {
  const [tab, setTab] = useState<'forecast' | 'reconciliation'>('forecast');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Previsão e conciliação</h1>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          {(
            [
              ['forecast', 'Previsão de pagamentos'],
              ['reconciliation', 'Conciliação bancária'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 ${tab === key ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'forecast' ? <ForecastTab /> : <ReconciliationTab />}
    </div>
  );
}
