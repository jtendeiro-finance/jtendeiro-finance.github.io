import { useState } from 'react';
import type { Transaction } from '../../types/models';
import { parseSaftXml, type SaftImportResult } from '../../lib/saft/parseSaft';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { MoneyText } from '../ui/MoneyText';
import { toast } from '../ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (txs: Omit<Transaction, 'id'>[]) => Promise<{ added: number; skipped: number }>;
}

export function SaftImportModal({ open, onClose, onImport }: Props) {
  const [result, setResult] = useState<SaftImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setResult(null);
    onClose();
  };

  const pickFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSaftXml(text);
      if (parsed.invoices.length === 0) {
        toast('error', 'Não foram encontradas faturas de venda no ficheiro SAF-T.');
        return;
      }
      setResult(parsed);
    } catch {
      toast('error', 'Não foi possível interpretar o ficheiro SAF-T (XML inválido?).');
    }
  };

  const doImport = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const { added, skipped } = await onImport(result.invoices);
      toast(
        'success',
        `${added} faturas importadas${skipped > 0 ? `, ${skipped} já existentes ignoradas` : ''}.`,
      );
      close();
    } catch {
      toast('error', 'A importação falhou. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const totalGross = result?.invoices.reduce((s, t) => s + t.amountCents, 0) ?? 0;
  const totalVat = result?.invoices.reduce((s, t) => s + (t.vatCents ?? 0), 0) ?? 0;

  return (
    <Modal open={open} onClose={close} title="Importar SAF-T (PT)">
      {!result ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-600">
            Carregue o ficheiro SAF-T (PT) exportado pelo seu programa de faturação certificado.
            As faturas de venda são importadas como receitas, com o IVA discriminado.
          </p>
          <label className="cursor-pointer rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            Escolher ficheiro XML
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
              }}
            />
          </label>
          <p className="text-xs text-slate-400">A reimportação do mesmo ficheiro não cria duplicados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Faturas</dt>
              <dd className="font-semibold">{result.invoices.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Total (c/ IVA)</dt>
              <dd className="font-semibold"><MoneyText cents={totalGross} /></dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">IVA liquidado</dt>
              <dd className="font-semibold"><MoneyText cents={totalVat} /></dd>
            </div>
          </dl>
          {result.warnings.length > 0 && (
            <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {result.warnings.slice(0, 5).map((w, i) => (
                <li key={i}>⚠️ {w}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setResult(null)}>Escolher outro ficheiro</Button>
            <Button onClick={() => void doImport()} busy={busy}>
              Importar {result.invoices.length} faturas
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
