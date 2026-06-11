/** Datas guardadas sempre como ISO "yyyy-mm-dd". */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function isoToday(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Parse de datas PT: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd.
 * Anos com 2 dígitos são interpretados como 20xx.
 */
export function parsePtDate(raw: string): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return validIso(parseInt(y, 10), parseInt(mo, 10), parseInt(d, 10));
  }
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (m[3].length === 2) y += 2000;
    return validIso(y, mo, d);
  }
  return null;
}

function validIso(y: number, mo: number, d: number): string | null {
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return toIso(y, mo, d);
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function daysUntil(iso: string, from: Date = new Date()): number {
  const target = isoToDate(iso).getTime();
  const base = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - base) / 86_400_000);
}

/** "2026-06-10" → "2026-06" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonthsToKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad2(nm)}`;
}

/** Último dia do mês (1–12). */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** ISO da segunda-feira da semana que contém a data. */
export function mondayOf(iso: string): string {
  const d = isoToDate(iso);
  const dow = d.getUTCDay(); // 0=domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(iso: string, delta: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + delta);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function monthLabelPt(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_PT[m - 1]} ${y}`;
}

export function formatDatePt(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
