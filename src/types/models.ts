export type Sector =
  | 'barbearia'
  | 'restauracao'
  | 'comercio'
  | 'servicos'
  | 'startup'
  | 'industria'
  | 'construcao'
  | 'outro';

export type LegalForm = 'ENI' | 'UnipessoalLda' | 'Lda' | 'SA';
export type IvaRegime = 'mensal' | 'trimestral' | 'isencao53';
export type IncomeTax = 'IRC' | 'IRS';

export interface CompanyProfile {
  name: string;
  sector: Sector;
  sectorOther?: string;
  legalForm: LegalForm;
  ivaRegime: IvaRegime;
  incomeTax: IncomeTax;
  employees: number;
  /** Custo mensal total com salários (incl. TSU), em cêntimos. Alimenta a previsão. */
  monthlyPayrollCents?: number;
  /** Dia do mês em que os salários são pagos (1–28). */
  payrollDayOfMonth?: number;
  fiscalYearStartMonth: number;
  createdAt: string;
}

export type TransactionSource = 'csv' | 'saft' | 'manual';

export interface Transaction {
  id: string;
  /** ISO yyyy-mm-dd */
  date: string;
  description: string;
  /** Cêntimos, com sinal: + receita, − despesa. */
  amountCents: number;
  categoryId: string;
  source: TransactionSource;
  counterparty?: string;
  vatCents?: number;
  docRef?: string;
  reconciledInvoiceId?: string;
  importedAt: string;
}

export type CategoryKind = 'income' | 'expense';

export interface Category {
  id: string;
  label: string;
  kind: CategoryKind;
  keywords: string[];
}

export type InvoiceDirection = 'payable' | 'receivable';

export type InvoiceStatus =
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'confirmed'
  | 'paid'
  | 'reconciled';

export interface Invoice {
  id: string;
  direction: InvoiceDirection;
  counterparty: string;
  nif?: string;
  number?: string;
  issueDate: string;
  dueDate?: string;
  descriptionSummary: string;
  netCents: number;
  vatCents: number;
  grossCents: number;
  categoryId: string;
  status: InvoiceStatus;
  extractionConfidence?: number;
  storagePath: string;
  matchedTransactionId?: string;
  createdAt: string;
}

export type ObligationId =
  | 'iva-declaracao'
  | 'iva-pagamento'
  | 'efatura'
  | 'dmr'
  | 'ss-declaracao'
  | 'ss-pagamento'
  | 'retencoes-fonte'
  | 'modelo22'
  | 'ies'
  | 'pagamento-conta-irc'
  | 'modelo10'
  | 'inventarios'
  | 'irs-modelo3'
  | 'subsidio-ferias'
  | 'subsidio-natal';

export interface FiscalObligation {
  /** `${obligationId}:${dueDate}` — chave estável para o estado feito/pendente. */
  key: string;
  obligationId: ObligationId;
  title: string;
  description: string;
  dueDate: string;
  periodLabel?: string;
}

export interface ObligationDefinition {
  id: ObligationId;
  title: string;
  description: string;
  appliesTo: (p: CompanyProfile) => boolean;
  occurrences: (p: CompanyProfile, year: number) => FiscalObligation[];
}

export type ObligationState = 'pending' | 'done';
export type ObligationStatusMap = Record<string, ObligationState>;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

export interface MonthlyTotal {
  /** "2026-06" */
  month: string;
  incomeCents: number;
  expenseCents: number;
}

export interface Kpis {
  cashPositionCents: number;
  monthly: MonthlyTotal[];
  topExpenseCategories: { categoryId: string; totalCents: number }[];
  profitMarginPct: number | null;
  avgMonthlyBurnCents: number;
  runwayMonths: number | null;
  estimatedIvaDueCents: number | null;
}

export type ForecastItemKind =
  | 'invoice'
  | 'payroll'
  | 'iva'
  | 'tsu'
  | 'retencoes'
  | 'recurring';

export interface ForecastItem {
  kind: ForecastItemKind;
  label: string;
  dueDate: string;
  amountCents: number;
  sourceId?: string;
}

export interface ForecastWeek {
  /** ISO da segunda-feira da semana */
  weekStart: string;
  items: ForecastItem[];
  totalOutCents: number;
  projectedBalanceCents: number;
}

export interface ReconciliationMatch {
  invoiceId: string;
  transactionId: string;
  score: number;
}

export interface ReconciliationSuggestion {
  invoiceId: string;
  candidates: { transactionId: string; score: number }[];
}

export interface ReconciliationResult {
  autoMatched: ReconciliationMatch[];
  suggestions: ReconciliationSuggestion[];
  unmatchedInvoiceIds: string[];
  unmatchedTransactionIds: string[];
}

export interface BackupEnvelope {
  app: 'assistente-cfo';
  version: 1;
  exportedAt: string;
  profile: CompanyProfile | null;
  transactions: Transaction[];
  invoices: Invoice[];
  obligationStatus: ObligationStatusMap;
  chat: ChatMessage[];
}
