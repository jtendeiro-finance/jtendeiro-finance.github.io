import { describe, expect, it } from 'vitest';
import { reconcile, scorePair } from '../reconciliation/reconcile';
import type { Invoice, Transaction } from '../../types/models';

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: overrides.id ?? 'inv1',
    direction: 'payable',
    counterparty: 'Distribuidora Silva',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
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

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'tx1',
    date: '2026-06-14',
    description: 'TRF Distribuidora Silva',
    amountCents: -10000,
    categoryId: 'fornecedores',
    source: 'csv',
    importedAt: '2026-06-20T00:00:00Z',
    ...overrides,
  };
}

describe('scorePair', () => {
  it('pontua alto com montante exato, data próxima e nome coincidente', () => {
    expect(scorePair(invoice({}), tx({}))).toBeGreaterThanOrEqual(0.8);
  });

  it('rejeita direção errada e montantes distantes', () => {
    expect(scorePair(invoice({}), tx({ amountCents: 10000 }))).toBe(0);
    expect(scorePair(invoice({}), tx({ amountCents: -55500 }))).toBe(0);
  });

  it('tolera diferença de 1% com pontuação reduzida', () => {
    const s = scorePair(invoice({}), tx({ amountCents: -10050 }));
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(scorePair(invoice({}), tx({})));
  });
});

describe('reconcile', () => {
  it('auto-associa pares inequívocos', () => {
    const r = reconcile([tx({})], [invoice({})]);
    expect(r.autoMatched).toHaveLength(1);
    expect(r.autoMatched[0]).toMatchObject({ invoiceId: 'inv1', transactionId: 'tx1' });
    expect(r.suggestions).toHaveLength(0);
  });

  it('com dois movimentos iguais, sugere em vez de auto-associar', () => {
    const r = reconcile(
      [tx({ id: 'a' }), tx({ id: 'b' })],
      [invoice({})],
    );
    expect(r.autoMatched).toHaveLength(0);
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0].candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('ignora faturas já pagas/conciliadas e movimentos já conciliados', () => {
    const r = reconcile(
      [tx({ reconciledInvoiceId: 'outra' })],
      [invoice({ status: 'reconciled' })],
    );
    expect(r.autoMatched).toHaveLength(0);
    expect(r.suggestions).toHaveLength(0);
    expect(r.unmatchedInvoiceIds).toHaveLength(0);
  });

  it('lista faturas e movimentos sem correspondência', () => {
    const r = reconcile(
      [tx({ id: 'longe', date: '2026-01-01', description: 'outra coisa', amountCents: -999 })],
      [invoice({})],
    );
    expect(r.unmatchedInvoiceIds).toEqual(['inv1']);
    expect(r.unmatchedTransactionIds).toEqual(['longe']);
  });
});
