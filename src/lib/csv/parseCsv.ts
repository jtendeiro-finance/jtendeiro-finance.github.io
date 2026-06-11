import Papa from 'papaparse';

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
  const [headers, ...rows] = data;
  return { headers: headers.map((h) => (h ?? '').trim()), rows };
}
