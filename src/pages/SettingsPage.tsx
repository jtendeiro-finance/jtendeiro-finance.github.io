import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/useAuth';
import { useProfile } from '../store/useProfile';
import type { CompanyProfile, IvaRegime, LegalForm, Sector } from '../types/models';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Labeled, Select, TextInput } from '../components/ui/Field';
import {
  buildBackup,
  clearAllData,
  downloadBackup,
  parseBackup,
  restoreBackup,
} from '../lib/backup/exportImport';
import { parsePtAmountToCents } from '../lib/money';
import { toast } from '../components/ui/Toast';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const uid = user!.uid;
  const { profile, save } = useProfile();
  const navigate = useNavigate();

  const p = profile!;
  const [name, setName] = useState(p.name);
  const [sector, setSector] = useState<Sector>(p.sector);
  const [legalForm, setLegalForm] = useState<LegalForm>(p.legalForm);
  const [ivaRegime, setIvaRegime] = useState<IvaRegime>(p.ivaRegime);
  const [employees, setEmployees] = useState(String(p.employees));
  const [payroll, setPayroll] = useState(
    p.monthlyPayrollCents != null ? (p.monthlyPayrollCents / 100).toFixed(2).replace('.', ',') : '',
  );
  const [payrollDay, setPayrollDay] = useState(String(p.payrollDayOfMonth ?? 25));
  const [busy, setBusy] = useState(false);

  const saveProfile = async () => {
    setBusy(true);
    try {
      const employeesNum = Math.max(0, Number(employees) || 0);
      const payrollCents = parsePtAmountToCents(payroll);
      const updated: CompanyProfile = {
        ...p,
        name: name.trim() || p.name,
        sector,
        legalForm,
        ivaRegime,
        incomeTax: legalForm === 'ENI' ? p.incomeTax : 'IRC',
        employees: employeesNum,
      };
      if (employeesNum > 0 && payrollCents) {
        updated.monthlyPayrollCents = payrollCents;
        updated.payrollDayOfMonth = Math.min(28, Math.max(1, Number(payrollDay) || 25));
      } else {
        delete updated.monthlyPayrollCents;
        delete updated.payrollDayOfMonth;
      }
      await save(uid, updated);
      toast('success', 'Perfil atualizado. O calendário fiscal foi recalculado.');
    } catch {
      toast('error', 'Não foi possível guardar o perfil.');
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      downloadBackup(await buildBackup(uid, profile));
      toast('success', 'Backup descarregado.');
    } catch {
      toast('error', 'Não foi possível exportar os dados.');
    } finally {
      setBusy(false);
    }
  };

  const importData = async (file: File) => {
    setBusy(true);
    try {
      const envelope = parseBackup(await file.text());
      await restoreBackup(uid, envelope);
      toast('success', 'Backup importado com sucesso.');
    } catch (e) {
      toast('error', (e as Error).message || 'Não foi possível importar o backup.');
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    if (!confirm('Apagar TODOS os dados da empresa? Esta ação não pode ser anulada.')) return;
    if (!confirm('Tem a certeza absoluta? Considere exportar um backup primeiro.')) return;
    setBusy(true);
    try {
      await clearAllData(uid);
      toast('success', 'Dados apagados.');
      navigate('/onboarding', { replace: true });
    } catch {
      toast('error', 'Não foi possível apagar todos os dados.');
    } finally {
      setBusy(false);
    }
  };

  const employeesNum = Math.max(0, Number(employees) || 0);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-bold">Definições</h1>

      <Card title="Perfil da empresa">
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Nome">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Labeled>
          <Labeled label="Setor">
            <Select value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
              <option value="barbearia">Barbearia / Cabeleireiro</option>
              <option value="restauracao">Restauração</option>
              <option value="comercio">Comércio</option>
              <option value="servicos">Serviços</option>
              <option value="startup">Startup tecnológica</option>
              <option value="industria">Indústria / Produção</option>
              <option value="construcao">Construção</option>
              <option value="outro">Outro</option>
            </Select>
          </Labeled>
          <Labeled label="Forma jurídica">
            <Select value={legalForm} onChange={(e) => setLegalForm(e.target.value as LegalForm)}>
              <option value="ENI">ENI</option>
              <option value="UnipessoalLda">Unipessoal Lda</option>
              <option value="Lda">Lda</option>
              <option value="SA">SA</option>
            </Select>
          </Labeled>
          <Labeled label="Regime de IVA">
            <Select value={ivaRegime} onChange={(e) => setIvaRegime(e.target.value as IvaRegime)}>
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="isencao53">Isenção (art. 53.º)</option>
            </Select>
          </Labeled>
          <Labeled label="Trabalhadores">
            <TextInput type="number" min={0} value={employees} onChange={(e) => setEmployees(e.target.value)} />
          </Labeled>
          {employeesNum > 0 && (
            <>
              <Labeled label="Folha salarial mensal (€)" hint="Salários brutos + TSU">
                <TextInput value={payroll} onChange={(e) => setPayroll(e.target.value)} />
              </Labeled>
              <Labeled label="Dia de pagamento">
                <TextInput type="number" min={1} max={28} value={payrollDay} onChange={(e) => setPayrollDay(e.target.value)} />
              </Labeled>
            </>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void saveProfile()} busy={busy}>Guardar alterações</Button>
        </div>
      </Card>

      <Card title="Dados">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void exportData()} busy={busy}>
            ⬇️ Exportar backup (JSON)
          </Button>
          <label>
            <Button
              variant="secondary"
              busy={busy}
              onClick={(e) => (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)?.click()}
            >
              ⬆️ Importar backup
            </Button>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importData(f);
                e.target.value = '';
              }}
            />
          </label>
          <Button variant="danger" onClick={() => void wipe()} busy={busy}>
            Apagar todos os dados
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          O backup inclui perfil, movimentos, faturas, estado do calendário e conversa com o CFO.
          Os PDFs das faturas permanecem no armazenamento seguro.
        </p>
      </Card>

      <Card title="Conta">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <p className="font-medium">{user!.displayName ?? user!.email}</p>
            <p className="text-xs text-slate-400">{user!.email}</p>
          </div>
          <Button variant="secondary" onClick={() => void logout()}>Terminar sessão</Button>
        </div>
      </Card>
    </div>
  );
}
