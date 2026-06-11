import { describe, expect, it } from 'vitest';
import { generateCalendar, nextDeadlines } from '../fiscal/generateCalendar';
import type { CompanyProfile } from '../../types/models';

function profile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    name: 'Teste Lda',
    sector: 'servicos',
    legalForm: 'Lda',
    ivaRegime: 'trimestral',
    incomeTax: 'IRC',
    employees: 0,
    fiscalYearStartMonth: 1,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function dueDates(p: CompanyProfile, year: number, id: string): string[] {
  return generateCalendar(p, year, year)
    .filter((o) => o.obligationId === id)
    .map((o) => o.dueDate);
}

describe('calendário fiscal PT', () => {
  it('IVA trimestral: 20 fev, 20 mai, 20 ago, 20 nov', () => {
    expect(dueDates(profile(), 2026, 'iva-declaracao')).toEqual([
      '2026-02-20', '2026-05-20', '2026-08-20', '2026-11-20',
    ]);
    expect(dueDates(profile(), 2026, 'iva-pagamento')).toEqual([
      '2026-02-25', '2026-05-25', '2026-08-25', '2026-11-25',
    ]);
  });

  it('IVA mensal: dia 20 de todos os meses', () => {
    const dates = dueDates(profile({ ivaRegime: 'mensal' }), 2026, 'iva-declaracao');
    expect(dates).toHaveLength(12);
    expect(dates[0]).toBe('2026-01-20');
    expect(dates[11]).toBe('2026-12-20');
  });

  it('isenção art. 53.º: sem obrigações de IVA', () => {
    const p = profile({ ivaRegime: 'isencao53' });
    expect(dueDates(p, 2026, 'iva-declaracao')).toHaveLength(0);
    expect(dueDates(p, 2026, 'iva-pagamento')).toHaveLength(0);
  });

  it('obrigações de empregador só com trabalhadores', () => {
    expect(dueDates(profile(), 2026, 'dmr')).toHaveLength(0);
    expect(dueDates(profile(), 2026, 'ss-pagamento')).toHaveLength(0);
    const withStaff = profile({ employees: 2 });
    expect(dueDates(withStaff, 2026, 'dmr')).toHaveLength(12);
    expect(dueDates(withStaff, 2026, 'dmr')[0]).toBe('2026-01-10');
    expect(dueDates(withStaff, 2026, 'ss-pagamento')[0]).toBe('2026-01-20');
    expect(dueDates(withStaff, 2026, 'subsidio-natal')).toEqual(['2026-12-01']);
  });

  it('anuais: Modelo 22, IES, pagamentos por conta, Modelo 10, inventários', () => {
    const p = profile();
    expect(dueDates(p, 2026, 'modelo22')).toEqual(['2026-05-31']);
    expect(dueDates(p, 2026, 'ies')).toEqual(['2026-07-15']);
    expect(dueDates(p, 2026, 'pagamento-conta-irc')).toEqual([
      '2026-07-31', '2026-09-30', '2026-12-15',
    ]);
    expect(dueDates(p, 2026, 'modelo10')).toEqual(['2026-02-10']);
    expect(dueDates(p, 2026, 'inventarios')).toEqual(['2026-01-31']);
  });

  it('ENI em IRS: Modelo 3 em vez de Modelo 22', () => {
    const eni = profile({ legalForm: 'ENI', incomeTax: 'IRS' });
    expect(dueDates(eni, 2026, 'irs-modelo3')).toEqual(['2026-06-30']);
    expect(dueDates(eni, 2026, 'modelo22')).toHaveLength(0);
    expect(dueDates(eni, 2026, 'pagamento-conta-irc')).toHaveLength(0);
  });

  it('e-Fatura e retenções aplicam-se a todos, todos os meses', () => {
    expect(dueDates(profile(), 2026, 'efatura')).toHaveLength(12);
    expect(dueDates(profile(), 2026, 'efatura')[5]).toBe('2026-06-05');
    expect(dueDates(profile(), 2026, 'retencoes-fonte')[5]).toBe('2026-06-20');
  });

  it('nextDeadlines ignora feitos e datas passadas', () => {
    const cal = generateCalendar(profile(), 2026, 2026);
    const first = nextDeadlines(cal, {}, 3, '2026-06-01');
    expect(first[0].dueDate >= '2026-06-01').toBe(true);
    const done = Object.fromEntries(first.map((o) => [o.key, 'done' as const]));
    const after = nextDeadlines(cal, done, 3, '2026-06-01');
    expect(after.every((o) => !(o.key in done))).toBe(true);
  });
});
