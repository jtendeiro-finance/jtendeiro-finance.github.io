import { describe, expect, it } from 'vitest';
import { parseCsvText } from '../csv/parseCsv';
import { applyMapping, guessMapping } from '../csv/columnMapping';

const PT_BANK_CSV = `Data Mov.;Data Valor;Descrição do Movimento;Débito;Crédito;Saldo
10/06/2026;10/06/2026;TRF P/ Distribuidora Silva;1.234,56;;5.000,00
09/06/2026;09/06/2026;TPA VENDAS DIA;;850,30;6.234,56
08/06/2026;08/06/2026;GALP AVEIRO;45,80;;5.384,26`;

const SIMPLE_CSV = `Data,Descrição,Montante
10/06/2026,Renda junho,"-750,00"
05/06/2026,Avença cliente A,"1.230,00"`;

describe('guessMapping + applyMapping', () => {
  it('deteta o par débito/crédito de extratos PT', () => {
    const csv = parseCsvText(PT_BANK_CSV);
    const m = guessMapping(csv.headers, csv.rows);
    expect(m.dateCol).toBe(0);
    expect(m.descriptionCol).toBe(2);
    expect(m.amountCol).toBeNull();
    expect(m.debitCol).toBe(3);
    expect(m.creditCol).toBe(4);

    const { ok, errors } = applyMapping(csv.rows, m);
    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(3);
    expect(ok[0].amountCents).toBe(-123456);
    expect(ok[1].amountCents).toBe(85030);
    expect(ok[2].categoryId).toBe('combustivel');
  });

  it('deteta coluna única de montante com sinal', () => {
    const csv = parseCsvText(SIMPLE_CSV);
    const m = guessMapping(csv.headers, csv.rows);
    expect(m.amountCol).toBe(2);
    const { ok } = applyMapping(csv.rows, m);
    expect(ok[0].amountCents).toBe(-75000);
    expect(ok[0].categoryId).toBe('rendas');
    expect(ok[1].amountCents).toBe(123000);
  });

  it('reporta linhas com data inválida sem rebentar', () => {
    const csv = parseCsvText('Data;Descrição;Montante\nxx/yy/zz;abc;1,00\n10/06/2026;ok;2,00');
    const m = guessMapping(csv.headers, csv.rows);
    const { ok, errors } = applyMapping(csv.rows, m);
    expect(ok).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].rowIndex).toBe(0);
  });
});
