import { useMemo, useState } from 'react';
import type { Transaction } from '../../types/models';
import { parseCsvFile, type RawCsv } from '../../lib/csv/parseCsv';
import {
  applyMapping,
  guessMapping,
  type ColumnMapping,
} from '../../lib/csv/columnMapping';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Labeled, Select } from '../ui/Field';
import { MoneyText } from '../ui/MoneyText';
import { categoryLabel } from '../../lib/categories/categories';
import { toast } from '../ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (txs: Omit<Transaction, 'id'>[]) => Promise<{ added: number; skipped: number }>;
}

function ColumnSelect({
  label,
  headers,
  value,
  onChange,
  allowNone,
}: {
  label: string;
  headers: string[];
  value: number | null;
  onChange: (v: number | null) => void;
  allowNone?: boolean;
}) {
  return (
    <Labeled label={label}>
      <Select
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        {allowNone && <option value="">— nenhuma —</option>}
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Coluna ${i + 1}`}
          </option>
        ))}
      </Select>
    </Labeled>
  );
}

export function CsvImportWizard({ open, onClose, onImport }: Props) {
  const [csv, setCsv] = useState<RawCsv | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCsv(null);
    setMapping(null);
    setFileName('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickFile = async (file: File) => {
    try {
      const parsed = await parseCsvFile(file);
      if (parsed.rows.length === 0) {
        toast('error', 'O ficheiro não contém linhas de dados.');
        return;
      }
      setCsv(parsed);
      setFileName(file.name);
      setMapping(guessMapping(parsed.headers, parsed.rows.slice(0, 10)));
    } catch {
      toast('error', 'Não foi possível ler o ficheiro CSV.');
    }
  };

  const preview = useMemo(() => {
    if (!csv || !mapping) return null;
    return applyMapping(csv.rows.slice(0, 8), mapping);
  }, [csv, mapping]);

  const full = useMemo(() => {
    if (!csv || !mapping) return null;
    return applyMapping(csv.rows, mapping);
  }, [csv, mapping]);

  const doImport = async () => {
    if (!full) return;
    setBusy(true);
    try {
      const { added, skipped } = await onImport(full.ok);
      toast(
        'success',
        `${added} movimentos importados${skipped > 0 ? `, ${skipped} duplicados ignorados` : ''}.`,
      );
      close();
    } catch {
      toast('error', 'A importação falhou. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const usePair = mapping?.amountCol === null;

  return (
    <Modal open={open} onClose={close} title="Importar extrato bancário (CSV)" wide>
      {!csv && (
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-600">
            Exporte o extrato da sua conta em CSV no homebanking e carregue-o aqui.
          </p>
          <label className="cursor-pointer rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            Escolher ficheiro
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
              }}
            />
          </label>
          <p className="text-xs text-slate-400">Suporta separador «;» ou «,» e formatos PT (dd/mm/aaaa, vírgula decimal).</p>
        </div>
      )}

      {csv && mapping && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500">
            <strong>{fileName}</strong> — {csv.rows.length} linhas. Confirme a correspondência das colunas:
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ColumnSelect
              label="Data"
              headers={csv.headers}
              value={mapping.dateCol}
              onChange={(v) => setMapping({ ...mapping, dateCol: v ?? 0 })}
            />
            <ColumnSelect
              label="Descrição"
              headers={csv.headers}
              value={mapping.descriptionCol}
              onChange={(v) => setMapping({ ...mapping, descriptionCol: v ?? 0 })}
            />
            <ColumnSelect
              label="Montante (com sinal)"
              headers={csv.headers}
              value={mapping.amountCol}
              onChange={(v) =>
                setMapping({ ...mapping, amountCol: v, ...(v !== null ? { debitCol: null, creditCol: null } : {}) })
              }
              allowNone
            />
            {usePair && (
              <div className="grid gap-3">
                <ColumnSelect
                  label="Débito"
                  headers={csv.headers}
                  value={mapping.debitCol}
                  onChange={(v) => setMapping({ ...mapping, debitCol: v })}
                  allowNone
                />
                <ColumnSelect
                  label="Crédito"
                  headers={csv.headers}
                  value={mapping.creditCol}
                  onChange={(v) => setMapping({ ...mapping, creditCol: v })}
                  allowNone
                />
              </div>
            )}
          </div>

          {preview && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2 text-right">Montante</th>
                    <th className="px-3 py-2">Categoria sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.ok.map((t, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 whitespace-nowrap">{t.date}</td>
                      <td className="max-w-60 truncate px-3 py-1.5">{t.description}</td>
                      <td className="px-3 py-1.5 text-right">
                        <MoneyText cents={t.amountCents} signed />
                      </td>
                      <td className="px-3 py-1.5">{categoryLabel(t.categoryId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {full && full.errors.length > 0 && (
            <p className="text-xs text-amber-700">
              ⚠️ {full.errors.length} linhas serão ignoradas (data ou montante inválidos) — ex.:{' '}
              {full.errors[0].reason}.
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={reset}>Escolher outro ficheiro</Button>
            <Button onClick={() => void doImport()} busy={busy} disabled={!full || full.ok.length === 0}>
              Importar {full?.ok.length ?? 0} movimentos
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
