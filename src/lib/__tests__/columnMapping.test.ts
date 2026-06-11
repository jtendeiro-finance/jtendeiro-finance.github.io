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

// Formato "tabulado" sem cabeçalho: conta;data mov.;data valor;descrição;zeros;
// débito;crédito;saldo;códigos… (montantes com zeros à esquerda).
const TABULATED_BANK_CSV = [
  '000363629356020;06-01-2026;06-01-2026;COMISSÃO DE GESTÃO                                ;00000000;-00000000000000015,90;                     ;+00000000000015154,01;  ;   ;000000000000000',
  '000363629356020;12-01-2026;12-01-2026;FT 2025/48-E1196523                               ;00000000;-00000000000000492,00;                     ;+00000000000011587,95;08;4T3;000000000000000',
  '000363629356020;19-01-2026;19-01-2026;TRF.IMED.   DE CLIENTE EXEMPLO-60690438           ;00000000;                     ;+00000000000100000,00;+00000000000100147,05;09;4TE;000000000000000',
  '000363629356020;19-01-2026;19-01-2026;TRANSFERENCIA - PAG. T.S.U.                       ;00000000;-00000000000010915,36;                     ;+00000000000042584,06;08;000;000000000000000',
].join('\n');

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

  it('deteta extrato tabulado sem cabeçalho (conta, débito/crédito, saldo)', () => {
    const csv = parseCsvText(TABULATED_BANK_CSV);
    // Sem cabeçalho: a 1.ª linha é dados, não nomes de colunas.
    expect(csv.rows).toHaveLength(4);
    expect(csv.headers.every((h) => h === '')).toBe(true);

    const m = guessMapping(csv.headers, csv.rows);
    expect(m.dateCol).toBe(1);
    expect(m.descriptionCol).toBe(3);
    expect(m.amountCol).toBeNull();
    expect(m.debitCol).toBe(5);
    expect(m.creditCol).toBe(6); // e não a coluna 7 (saldo, sempre preenchida)

    const { ok, errors } = applyMapping(csv.rows, m);
    expect(errors).toHaveLength(0);
    expect(ok.map((t) => t.amountCents)).toEqual([-1590, -49200, 10000000, -1091536]);
    expect(ok[0].date).toBe('2026-01-06');
    expect(ok[0].description).toBe('COMISSÃO DE GESTÃO');
    expect(ok[2].description).toBe('TRF.IMED. DE CLIENTE EXEMPLO-60690438');
  });

  it('deteta par débito/crédito mesmo sem créditos na amostra', () => {
    // Só linhas de débito: o crédito fica por mapear mas a importação funciona.
    const csv = parseCsvText(TABULATED_BANK_CSV.split('\n').filter((l) => !l.includes('TRF.IMED')).join('\n'));
    const m = guessMapping(csv.headers, csv.rows);
    expect(m.debitCol).toBe(5);
    const { ok, errors } = applyMapping(csv.rows, m);
    expect(errors).toHaveLength(0);
    expect(ok.map((t) => t.amountCents)).toEqual([-1590, -49200, -1091536]);
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
