import Papa from 'papaparse';
import { parsePtDate } from '../dates';

export interface RawCsv {
  headers: string[];
  rows: string[][];
}

function decode(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  // Heurística: se houver muitos U+FFFD, tentamos windows-1252 (comum em exports bancários PT).
  const bad = (utf8.match(/�/g) ?? []).length;
  if (bad > 0) {
    try {
      return new TextDecoder('windows-1252').decode(buffer);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

export async function parseCsvFile(file: File): Promise<RawCsv> {
  const text = decode(await file.arrayBuffer());
  return parseCsvText(text);
}

export function parseCsvText(text: string): RawCsv {
  const result = Papa.parse<string[]>(text.trim(), {
    delimitersToGuess: [';', ',', '\t', '|'],
    skipEmptyLines: 'greedy',
  });
  const data = (result.data as string[][]).filter((r) => r.some((c) => c && c.trim() !== ''));
  if (data.length === 0) return { headers: [], rows: [] };

  // Alguns bancos exportam sem linha de cabeçalho (formato "tabulado").
  // Se a primeira linha já contém uma data, é uma linha de dados.
  const first = data[0].map((c) => (c ?? '').trim());
  if (first.some((c) => parsePtDate(c) !== null)) {
    return { headers: first.map(() => ''), rows: data };
  }

  const [headers, ...rows] = data;
  return { headers: headers.map((h) => (h ?? '').trim()), rows };
}
