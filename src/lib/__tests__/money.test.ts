import { describe, expect, it } from 'vitest';
import { parsePtAmountToCents, formatCents } from '../money';

describe('parsePtAmountToCents', () => {
  it('interpreta formato PT com milhares e decimais', () => {
    expect(parsePtAmountToCents('1.234,56')).toBe(123456);
    expect(parsePtAmountToCents('1 234,56 €')).toBe(123456);
    expect(parsePtAmountToCents('0,05')).toBe(5);
  });

  it('interpreta negativos e parêntesis', () => {
    expect(parsePtAmountToCents('-123,45')).toBe(-12345);
    expect(parsePtAmountToCents('(123,45)')).toBe(-12345);
    expect(parsePtAmountToCents('-1.000,00')).toBe(-100000);
  });

  it('interpreta formato EN como recurso', () => {
    expect(parsePtAmountToCents('1234.56')).toBe(123456);
    expect(parsePtAmountToCents('1,234.56')).toBe(123456);
  });

  it('trata ponto único com 3 dígitos como milhar (convenção PT)', () => {
    expect(parsePtAmountToCents('1.234')).toBe(123400);
  });

  it('rejeita lixo', () => {
    expect(parsePtAmountToCents('')).toBeNull();
    expect(parsePtAmountToCents('abc')).toBeNull();
    expect(parsePtAmountToCents('12,34,56€x')).toBeNull();
  });
});

describe('formatCents', () => {
  it('formata em EUR pt-PT', () => {
    expect(formatCents(123456)).toContain('€');
    expect(formatCents(123456)).toContain('1234,56');
    // pt-PT só agrupa milhares a partir de 5 dígitos (minimumGroupingDigits=2)
    expect(formatCents(1234567).replace(/\s/g, ' ')).toContain('12 345,67');
  });
});
