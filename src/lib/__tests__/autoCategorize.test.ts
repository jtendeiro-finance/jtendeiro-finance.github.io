import { describe, expect, it } from 'vitest';
import { autoCategorize } from '../categories/autoCategorize';

describe('autoCategorize', () => {
  it('classifica por palavra-chave, sem acentos e maiúsculas', () => {
    expect(autoCategorize('GALP LISBOA', -3500)).toBe('combustivel');
    expect(autoCategorize('Pagamento SEGURANÇA SOCIAL', -45000)).toBe('seguranca-social');
    expect(autoCategorize('RENDA JUNHO', -75000)).toBe('rendas');
    expect(autoCategorize('EDP Comercial', -8900)).toBe('agua-energia');
    expect(autoCategorize('Transferência ordenado João', -120000)).toBe('salarios');
  });

  it('usa o sinal como recurso quando não há keyword', () => {
    expect(autoCategorize('XYZ qualquer coisa', 1000)).toBe('outros-rendimentos');
    expect(autoCategorize('XYZ qualquer coisa', -1000)).toBe('outros-gastos');
  });
});
