import { CATEGORIES, EXPENSE_FALLBACK, INCOME_FALLBACK } from './categories';

/** Normaliza para comparação: minúsculas e sem acentos. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Atribui uma categoria com base em palavras-chave na descrição.
 * O sinal do montante desempata entre categorias de receita e despesa.
 */
export function autoCategorize(description: string, amountCents: number): string {
  const norm = normalizeText(description);
  const preferredKind = amountCents >= 0 ? 'income' : 'expense';

  let fallbackHit: string | null = null;
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => norm.includes(normalizeText(k)))) {
      if (cat.kind === preferredKind) return cat.id;
      if (fallbackHit === null) fallbackHit = cat.id;
    }
  }
  if (fallbackHit) return fallbackHit;
  return amountCents >= 0 ? INCOME_FALLBACK : EXPENSE_FALLBACK;
}
