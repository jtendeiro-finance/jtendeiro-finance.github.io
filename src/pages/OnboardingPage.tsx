import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/useAuth';
import { useProfile } from '../store/useProfile';
import type { CompanyProfile, IncomeTax, IvaRegime, LegalForm, Sector } from '../types/models';
import { Button } from '../components/ui/Button';
import { Labeled, Select, TextInput } from '../components/ui/Field';
import { parsePtAmountToCents, formatCents } from '../lib/money';
import { toast } from '../components/ui/Toast';

const SECTORS: { value: Sector; label: string }[] = [
  { value: 'barbearia', label: 'Barbearia / Cabeleireiro' },
  { value: 'restauracao', label: 'Restauração' },
  { value: 'comercio', label: 'Comércio' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'startup', label: 'Startup tecnológica' },
  { value: 'industria', label: 'Indústria / Produção' },
  { value: 'construcao', label: 'Construção' },
  { value: 'outro', label: 'Outro' },
];

const LEGAL_FORMS: { value: LegalForm; label: string }[] = [
  { value: 'ENI', label: 'Empresário em Nome Individual (ENI)' },
  { value: 'UnipessoalLda', label: 'Unipessoal Lda' },
  { value: 'Lda', label: 'Sociedade por Quotas (Lda)' },
  { value: 'SA', label: 'Sociedade Anónima (SA)' },
];

const IVA_REGIMES: { value: IvaRegime; label: string }[] = [
  { value: 'trimestral', label: 'IVA — regime trimestral' },
  { value: 'mensal', label: 'IVA — regime mensal' },
  { value: 'isencao53', label: 'Isenção de IVA (art. 53.º CIVA)' },
];

export default function OnboardingPage() {
  const uid = useAuth((s) => s.user?.uid);
  const { profile, save } = useProfile();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [sector, setSector] = useState<Sector>('servicos');
  const [sectorOther, setSectorOther] = useState('');
  const [legalForm, setLegalForm] = useState<LegalForm>('UnipessoalLda');
  const [ivaRegime, setIvaRegime] = useState<IvaRegime>('trimestral');
  const [incomeTax, setIncomeTax] = useState<IncomeTax>('IRC');
  const [employees, setEmployees] = useState('0');
  const [payroll, setPayroll] = useState('');
  const [payrollDay, setPayrollDay] = useState('25');

  if (profile) return <Navigate to="/" replace />;

  const employeesNum = Math.max(0, Number(employees) || 0);
  const payrollCents = parsePtAmountToCents(payroll);

  const finish = async () => {
    if (!uid) return;
    setBusy(true);
    try {
      const p: CompanyProfile = {
        name: name.trim(),
        sector,
        ...(sector === 'outro' && sectorOther.trim() ? { sectorOther: sectorOther.trim() } : {}),
        legalForm,
        ivaRegime,
        incomeTax: legalForm === 'ENI' ? incomeTax : 'IRC',
        employees: employeesNum,
        ...(employeesNum > 0 && payrollCents
          ? {
              monthlyPayrollCents: payrollCents,
              payrollDayOfMonth: Math.min(28, Math.max(1, Number(payrollDay) || 25)),
            }
          : {}),
        fiscalYearStartMonth: 1,
        createdAt: new Date().toISOString(),
      };
      await save(uid, p);
      toast('success', 'Perfil da empresa criado. Bem-vindo!');
      navigate('/', { replace: true });
    } catch {
      toast('error', 'Não foi possível guardar o perfil. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const steps = ['Identificação', 'Enquadramento fiscal', 'Folha salarial', 'Confirmação'];

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-lg font-bold">Configurar a sua empresa</h1>
        <p className="mb-5 text-sm text-slate-500">
          Estes dados definem o calendário fiscal e as análises do seu CFO virtual.
        </p>

        <ol className="mb-6 flex gap-2 text-xs">
          {steps.map((s, i) => (
            <li
              key={s}
              className={`flex-1 rounded-full px-2 py-1 text-center ${
                i === step ? 'bg-brand-700 text-white' : i < step ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Labeled label="Nome da empresa">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Barbearia Central, Lda" />
            </Labeled>
            <Labeled label="Setor de atividade">
              <Select value={sector} onChange={(e) => setSector(e.target.value as Sector)}>
                {SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Labeled>
            {sector === 'outro' && (
              <Labeled label="Descreva o setor">
                <TextInput value={sectorOther} onChange={(e) => setSectorOther(e.target.value)} />
              </Labeled>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Labeled label="Forma jurídica">
              <Select value={legalForm} onChange={(e) => setLegalForm(e.target.value as LegalForm)}>
                {LEGAL_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </Labeled>
            <Labeled label="Regime de IVA" hint="Em caso de dúvida, consulte o seu contabilista — a maioria das pequenas empresas está no regime trimestral.">
              <Select value={ivaRegime} onChange={(e) => setIvaRegime(e.target.value as IvaRegime)}>
                {IVA_REGIMES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </Labeled>
            {legalForm === 'ENI' && (
              <Labeled label="Tributação do rendimento">
                <Select value={incomeTax} onChange={(e) => setIncomeTax(e.target.value as IncomeTax)}>
                  <option value="IRS">IRS (categoria B)</option>
                  <option value="IRC">IRC</option>
                </Select>
              </Labeled>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Labeled label="Número de trabalhadores (sem contar com o próprio)">
              <TextInput type="number" min={0} value={employees} onChange={(e) => setEmployees(e.target.value)} />
            </Labeled>
            {employeesNum > 0 && (
              <>
                <Labeled
                  label="Custo mensal total com salários (€)"
                  hint="Inclua salários brutos + TSU. Usado na previsão semanal de pagamentos."
                >
                  <TextInput value={payroll} onChange={(e) => setPayroll(e.target.value)} placeholder="Ex.: 3 500,00" />
                </Labeled>
                <Labeled label="Dia do mês em que paga os salários">
                  <TextInput type="number" min={1} max={28} value={payrollDay} onChange={(e) => setPayrollDay(e.target.value)} />
                </Labeled>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm">
            <dt className="text-slate-500">Empresa</dt>
            <dd className="font-medium">{name || '—'}</dd>
            <dt className="text-slate-500">Setor</dt>
            <dd className="font-medium">
              {sector === 'outro' ? sectorOther || 'Outro' : SECTORS.find((s) => s.value === sector)?.label}
            </dd>
            <dt className="text-slate-500">Forma jurídica</dt>
            <dd className="font-medium">{LEGAL_FORMS.find((f) => f.value === legalForm)?.label}</dd>
            <dt className="text-slate-500">IVA</dt>
            <dd className="font-medium">{IVA_REGIMES.find((r) => r.value === ivaRegime)?.label}</dd>
            <dt className="text-slate-500">Tributação</dt>
            <dd className="font-medium">{legalForm === 'ENI' ? incomeTax : 'IRC'}</dd>
            <dt className="text-slate-500">Trabalhadores</dt>
            <dd className="font-medium">{employeesNum}</dd>
            {employeesNum > 0 && payrollCents != null && (
              <>
                <dt className="text-slate-500">Folha salarial mensal</dt>
                <dd className="font-medium">{formatCents(payrollCents)}</dd>
              </>
            )}
          </dl>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Anterior
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && name.trim().length === 0}>
              Seguinte
            </Button>
          ) : (
            <Button onClick={() => void finish()} busy={busy}>
              Concluir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
