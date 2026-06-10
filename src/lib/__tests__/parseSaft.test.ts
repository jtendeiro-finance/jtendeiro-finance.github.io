// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSaftXml } from '../saft/parseSaft';

const xml = readFileSync(join(__dirname, '../../../samples/saft-exemplo.xml'), 'utf-8');

describe('parseSaftXml', () => {
  it('extrai as faturas válidas com totais e IVA', () => {
    const r = parseSaftXml(xml);
    // 4 documentos: 2 FT válidas + 1 NC + 1 anulada (ignorada)
    expect(r.invoices).toHaveLength(3);

    const ft101 = r.invoices.find((i) => i.docRef === 'FT 2026/101')!;
    expect(ft101.date).toBe('2026-05-03');
    expect(ft101.amountCents).toBe(123000);
    expect(ft101.vatCents).toBe(23000);
    expect(ft101.counterparty).toBe('Cliente Alfa, Lda');
    expect(ft101.source).toBe('saft');
    expect(ft101.categoryId).toBe('vendas');
  });

  it('importa notas de crédito com sinal negativo', () => {
    const r = parseSaftXml(xml);
    const nc = r.invoices.find((i) => i.docRef === 'NC 2026/7')!;
    expect(nc.amountCents).toBe(-12300);
    expect(nc.vatCents).toBe(-2300);
    expect(r.warnings.some((w) => w.includes('Nota de crédito'))).toBe(true);
  });

  it('ignora faturas anuladas com aviso', () => {
    const r = parseSaftXml(xml);
    expect(r.invoices.find((i) => i.docRef === 'FT 2026/103')).toBeUndefined();
    expect(r.warnings.some((w) => w.includes('anulada'))).toBe(true);
  });

  it('lê clientes e fornecedores dos MasterFiles', () => {
    const r = parseSaftXml(xml);
    expect(r.customers).toHaveLength(2);
    expect(r.suppliers).toEqual([{ id: 'F001', name: 'Distribuidora Silva' }]);
  });

  it('rejeita XML inválido', () => {
    expect(() => parseSaftXml('<não é xml')).toThrow();
  });
});
