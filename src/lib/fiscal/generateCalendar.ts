import type {
  CompanyProfile,
  FiscalObligation,
  ObligationStatusMap,
} from '../../types/models';
import { OBLIGATION_DEFINITIONS } from './obligations';

/** Gera todas as ocorrências aplicáveis ao perfil para o intervalo de anos dado. */
export function generateCalendar(
  profile: CompanyProfile,
  fromYear: number,
  toYear: number,
): FiscalObligation[] {
  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y++) years.push(y);

  return OBLIGATION_DEFINITIONS.filter((d) => d.appliesTo(profile))
    .flatMap((d) => years.flatMap((y) => d.occurrences(profile, y)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Próximos n prazos pendentes a partir de hoje (inclusive). */
export function nextDeadlines(
  calendar: FiscalObligation[],
  status: ObligationStatusMap,
  n: number,
  todayIso: string,
): FiscalObligation[] {
  return calendar
    .filter((o) => o.dueDate >= todayIso && status[o.key] !== 'done')
    .slice(0, n);
}
