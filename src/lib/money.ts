/**
 * Parse de montantes em formatos portugueses para cêntimos (inteiro).
 * Aceita: "1.234,56", "1 234,56 €", "-123,45", "(123,45)", "1234.56".
 * Devolve null quando não é interpretável.
 */
export function parsePtAmountToCents(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === '') return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[€\s ]/g, '');
  if (s.startsWith('-')) {
    negative = !negative ? true : negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (s === '' || /[^0-9.,]/.test(s)) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  let intPart: string;
  let fracPart: string;

  if (hasComma && hasDot) {
    // O último separador é o decimal; o outro são milhares.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      intPart = s.slice(0, s.lastIndexOf(',')).replace(/\./g, '');
      fracPart = s.slice(s.lastIndexOf(',') + 1);
    } else {
      intPart = s.slice(0, s.lastIndexOf('.')).replace(/,/g, '');
      fracPart = s.slice(s.lastIndexOf('.') + 1);
    }
  } else if (hasComma) {
    const idx = s.lastIndexOf(',');
    intPart = s.slice(0, idx).replace(/,/g, '');
    fracPart = s.slice(idx + 1);
  } else if (hasDot) {
    const idx = s.lastIndexOf('.');
    const after = s.slice(idx + 1);
    if (after.length === 3 && s.indexOf('.') === idx) {
      // "1.234" — ambíguo; tratamos como milhares (convenção PT).
      intPart = s.replace(/\./g, '');
      fracPart = '';
    } else {
      intPart = s.slice(0, idx).replace(/\./g, '');
      fracPart = after;
    }
  } else {
    intPart = s;
    fracPart = '';
  }

  if (fracPart.length > 2) {
    // Mais de 2 casas — provavelmente separador de milhares mal interpretado.
    intPart = intPart + fracPart;
    fracPart = '';
  }
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  if (intPart === '' && fracPart === '') return null;

  const cents =
    (intPart === '' ? 0 : parseInt(intPart, 10)) * 100 +
    (fracPart === '' ? 0 : parseInt(fracPart.padEnd(2, '0'), 10));
  return negative ? -cents : cents;
}

const EUR = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

export function formatCents(cents: number): string {
  return EUR.format(cents / 100);
}

/** Formato compacto para gráficos: "1,2 mil €" → usamos k simples. */
export function formatCentsCompact(cents: number): string {
  const eur = cents / 100;
  if (Math.abs(eur) >= 1000) {
    return `${(eur / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}k €`;
  }
  return `${eur.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} €`;
}
