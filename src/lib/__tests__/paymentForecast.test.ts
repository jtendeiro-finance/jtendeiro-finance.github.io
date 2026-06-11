import { describe, expect, it } from 'vitest';
import { paymentForecast } from '../forecast/paymentForecast';
import { computeKpis } from '../kpi/kpi';
import { generateCalendar } from '../fiscal/generateCalendar';
import type { CompanyProfile, Invoice, Transaction } from '../../types/models';

const TODAY = new Date(2026, 5, 10); // 10 jun 2026

function profile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    name: 'Teste Lda',
    sector: 'restauracao',
    legalForm: 'Lda',
    ivaRegime: 'trimestral',
    incomeTax: 'IRC',
    employees: 2,
    monthlyPayrollCents: 300000,
    payrollDayOfMonth: 25,
    fiscalYearStartMonth: 1,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: overrides.id ?? 'inv1',
    direction: 'payable',
    counterparty: 'Fornecedor X',
    issueDate: '2026-06-01',
    descriptionSummary: 'Mercadoria',
    netCents: 8130,
    vatCents: 1870,
    grossCents: 10000,
    categoryId: 'fornecedores',
    status: 'confirmed',
    storagePath: 'users/u/invoices/inv1.pdf',
    createdAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function run(opts: { transactions?: Transaction[]; invoices?: Invoice[]; p?: CompanyProfile }) {
  const p = opts.p ?? profile();
  const transactions = opts.transactions ?? [];
  const kpis = computeKpis(transactions, TODAY);
  const calendar = generateCalendar(p, 2026, 2026);
  return paymentForecast({
    transactions,
    invoices: opts.invoices ?? [],
    profile: p,
    calendar,
    kpis,
    today: TODAY,
  });
}

describe('paymentForecast', () => {
  it('devolve 8 semanas começando na segunda-feira corrente', () => {
    const weeks = run({});
    expect(weeks).toHaveLength(8);
    expect(weeks[0].weekStart).toBe('2026-06-08');
    expect(weeks[1].weekStart).toBe('2026-06-15');
  });

  it('coloca a fatura a pagar na semana do vencimento', () => {
    const weeks = run({ invoices: [invoice({ dueDate: '2026-06-17' })] });
    const week = weeks.find((w) => w.weekStart === '2026-06-15')!;
    expect(week.items.some((i) => i.kind === 'invoice' && i.amountCents === 10000)).toBe(true);
  });

  it('faturas vencidas entram já na primeira semana', () => {
    const weeks = run({ invoices: [invoice({ dueDate: '2026-05-01' })] });
    expect(weeks[0].items.some((i) => i.kind === 'invoice')).toBe(true);
  });

  it('faturas pagas/conciliadas e a receber não contam', () => {
    const weeks = run({
      invoices: [
        invoice({ id: 'a', dueDate: '2026-06-17', status: 'paid' }),
        invoice({ id: 'b', dueDate: '2026-06-17', direction: 'receivable' }),
      ],
    });
    expect(weeks.every((w) => !w.items.some((i) => i.kind === 'invoice'))).toBe(true);
  });

  it('inclui salários no dia configurado e TSU no dia 20', () => {
    const weeks = run({});
    const all = weeks.flatMap((w) => w.items);
    const payroll = all.filter((i) => i.kind === 'payroll');
    expect(payroll.length).toBeGreaterThanOrEqual(1);
    expect(payroll[0].dueDate).toBe('2026-06-25');
    expect(payroll[0].amountCents).toBe(300000);
    const tsu = all.find((i) => i.kind === 'tsu');
    expect(tsu).toBeDefined();
    expect(tsu!.amountCents).toBe(75000); // 25% de 3000 €
  });

  it('saldo projetado desce com as saídas e fica negativo quando o caixa não chega', () => {
    const transactions: Transaction[] = [
      {
        id: 't1', date: '2026-06-01', description: 'saldo inicial', amountCents: 100000,
        categoryId: 'vendas', source: 'manual', importedAt: '2026-06-01T00:00:00Z',
      },
    ];
    const weeks = run({ transactions, invoices: [invoice({ dueDate: '2026-06-17', grossCents: 500000 })] });
    const w = weeks.find((x) => x.weekStart === '2026-06-15')!;
    expect(w.projectedBalanceCents).toBeLessThan(0);
    // o saldo nunca volta a subir (não há receitas previstas)
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].projectedBalanceCents).toBeLessThanOrEqual(weeks[i - 1].projectedBalanceCents);
    }
  });
});
