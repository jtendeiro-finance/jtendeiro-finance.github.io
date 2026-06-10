import { describe, expect, it } from 'vitest';
import { computeKpis } from '../kpi/kpi';
import type { Transaction } from '../../types/models';

function tx(date: string, amountCents: number, categoryId = 'outros-gastos', vatCents?: number): Transaction {
  return {
    id: `${date}-${amountCents}`,
    date,
    description: 'teste',
    amountCents,
    categoryId,
    source: 'csv',
    importedAt: '2026-01-01T00:00:00Z',
    ...(vatCents != null ? { vatCents } : {}),
  };
}

// "Hoje" fixo: 10 jun 2026.
const TODAY = new Date(2026, 5, 10);

describe('computeKpis', () => {
  it('calcula posição de tesouraria e série mensal', () => {
    const k = computeKpis(
      [tx('2026-06-01', 100000, 'vendas'), tx('2026-06-05', -40000), tx('2026-05-15', 50000, 'vendas')],
      TODAY,
    );
    expect(k.cashPositionCents).toBe(110000);
    expect(k.monthly).toHaveLength(12);
    const june = k.monthly.find((m) => m.month === '2026-06')!;
    expect(june.incomeCents).toBe(100000);
    expect(june.expenseCents).toBe(40000);
  });

  it('calcula burn médio e runway com 3 meses negativos', () => {
    // mar, abr, mai: −1000 € líquidos/mês; saldo atual 3000 €.
    const txs = [
      tx('2026-03-10', -100000),
      tx('2026-04-10', -100000),
      tx('2026-05-10', -100000),
      tx('2026-01-02', 600000, 'vendas'),
    ];
    const k = computeKpis(txs, TODAY);
    expect(k.avgMonthlyBurnCents).toBe(100000);
    expect(k.runwayMonths).toBe(3);
  });

  it('runway é null quando o fluxo é positivo', () => {
    const k = computeKpis(
      [tx('2026-03-10', 100000, 'vendas'), tx('2026-04-10', 100000, 'vendas'), tx('2026-05-10', 100000, 'vendas')],
      TODAY,
    );
    expect(k.runwayMonths).toBeNull();
  });

  it('estima IVA do mês corrente a partir de vatCents', () => {
    const k = computeKpis(
      [tx('2026-06-02', 12300, 'vendas', 2300), tx('2026-05-02', 12300, 'vendas', 2300)],
      TODAY,
    );
    expect(k.estimatedIvaDueCents).toBe(2300);
  });

  it('top categorias de despesa nos últimos 90 dias', () => {
    const k = computeKpis(
      [
        tx('2026-06-01', -50000, 'rendas'),
        tx('2026-05-20', -30000, 'fornecedores'),
        tx('2025-12-01', -999999, 'equipamento'), // fora da janela
      ],
      TODAY,
    );
    expect(k.topExpenseCategories[0]).toEqual({ categoryId: 'rendas', totalCents: 50000 });
    expect(k.topExpenseCategories.find((c) => c.categoryId === 'equipamento')).toBeUndefined();
  });
});
