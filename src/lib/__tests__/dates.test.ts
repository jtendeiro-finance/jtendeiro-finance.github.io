import { describe, expect, it } from 'vitest';
import {
  addMonthsToKey,
  daysUntil,
  mondayOf,
  monthKey,
  parsePtDate,
} from '../dates';

describe('parsePtDate', () => {
  it('aceita dd/mm/yyyy, dd-mm-yyyy e ISO', () => {
    expect(parsePtDate('31/12/2025')).toBe('2025-12-31');
    expect(parsePtDate('31-12-2025')).toBe('2025-12-31');
    expect(parsePtDate('1/2/2026')).toBe('2026-02-01');
    expect(parsePtDate('2026-06-10')).toBe('2026-06-10');
  });

  it('rejeita datas impossíveis', () => {
    expect(parsePtDate('32/01/2026')).toBeNull();
    expect(parsePtDate('29/02/2025')).toBeNull();
    expect(parsePtDate('')).toBeNull();
  });

  it('aceita 29/02 em ano bissexto', () => {
    expect(parsePtDate('29/02/2024')).toBe('2024-02-29');
  });
});

describe('helpers de datas', () => {
  it('daysUntil conta a partir de hoje', () => {
    const from = new Date(2026, 5, 10); // 10 jun 2026 (local)
    expect(daysUntil('2026-06-15', from)).toBe(5);
    expect(daysUntil('2026-06-09', from)).toBe(-1);
  });

  it('mondayOf devolve a segunda-feira da semana', () => {
    expect(mondayOf('2026-06-10')).toBe('2026-06-08'); // quarta → segunda
    expect(mondayOf('2026-06-08')).toBe('2026-06-08');
    expect(mondayOf('2026-06-14')).toBe('2026-06-08'); // domingo → segunda anterior
  });

  it('addMonthsToKey atravessa anos', () => {
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToKey('2026-11', 3)).toBe('2027-02');
  });

  it('monthKey extrai o mês', () => {
    expect(monthKey('2026-06-10')).toBe('2026-06');
  });
});
