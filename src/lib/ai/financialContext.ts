import type {
  Alert,
  CompanyProfile,
  FiscalObligation,
  ForecastWeek,
  Kpis,
} from '../../types/models';
import { formatCents } from '../money';
import { formatDatePt, monthLabelPt } from '../dates';
import { categoryLabel } from '../categories/categories';

const SECTOR_LABELS: Record<string, string> = {
  barbearia: 'barbearia/cabeleireiro',
  restauracao: 'restauração',
  comercio: 'comércio',
  servicos: 'serviços',
  startup: 'startup tecnológica',
  industria: 'indústria/produção',
  construcao: 'construção',
  outro: 'outro',
};

const LEGAL_LABELS: Record<string, string> = {
  ENI: 'Empresário em Nome Individual',
  UnipessoalLda: 'Sociedade Unipessoal por Quotas',
  Lda: 'Sociedade por Quotas (Lda)',
  SA: 'Sociedade Anónima (SA)',
};

const IVA_LABELS: Record<string, string> = {
  mensal: 'IVA regime mensal',
  trimestral: 'IVA regime trimestral',
  isencao53: 'isenção de IVA (art. 53.º)',
};

/**
 * Resumo financeiro compacto enviado às Cloud Functions (nunca transações em bruto).
 * É incorporado no system prompt do CFO no servidor.
 */
export function buildFinancialContext(
  profile: CompanyProfile,
  kpis: Kpis,
  deadlines: FiscalObligation[],
  alerts: Alert[],
  forecast: ForecastWeek[],
): string {
  const lines: string[] = [];

  const sector =
    profile.sector === 'outro' && profile.sectorOther
      ? profile.sectorOther
      : SECTOR_LABELS[profile.sector] ?? profile.sector;

  lines.push(
    `Empresa: «${profile.name}» — setor: ${sector}; forma jurídica: ${LEGAL_LABELS[profile.legalForm]}; ` +
      `${IVA_LABELS[profile.ivaRegime]}; tributação: ${profile.incomeTax}; ` +
      `trabalhadores: ${profile.employees}.`,
  );

  lines.push(`Saldo de tesouraria atual: ${formatCents(kpis.cashPositionCents)}.`);

  const recent = kpis.monthly.slice(-6);
  if (recent.some((m) => m.incomeCents > 0 || m.expenseCents > 0)) {
    lines.push('Últimos 6 meses (receitas / despesas / resultado):');
    for (const m of recent) {
      const net = m.incomeCents - m.expenseCents;
      lines.push(
        `- ${monthLabelPt(m.month)}: ${formatCents(m.incomeCents)} / ${formatCents(m.expenseCents)} / ${formatCents(net)}`,
      );
    }
  } else {
    lines.push('Sem movimentos registados nos últimos 6 meses.');
  }

  if (kpis.topExpenseCategories.length > 0) {
    lines.push(
      'Principais categorias de despesa (90 dias): ' +
        kpis.topExpenseCategories
          .map((c) => `${categoryLabel(c.categoryId)} ${formatCents(c.totalCents)}`)
          .join('; ') +
        '.',
    );
  }

  if (kpis.profitMarginPct !== null) {
    lines.push(`Margem (90 dias): ${kpis.profitMarginPct.toLocaleString('pt-PT')}%.`);
  }
  if (kpis.runwayMonths !== null) {
    lines.push(
      `Runway estimado: ${kpis.runwayMonths.toLocaleString('pt-PT')} meses ` +
        `(burn médio ${formatCents(kpis.avgMonthlyBurnCents)}/mês).`,
    );
  }
  if (kpis.estimatedIvaDueCents !== null) {
    lines.push(`IVA estimado do período corrente: ${formatCents(kpis.estimatedIvaDueCents)}.`);
  }

  if (forecast.length > 0) {
    const totalOut4w = forecast.slice(0, 4).reduce((a, w) => a + w.totalOutCents, 0);
    const minBalance = Math.min(...forecast.slice(0, 4).map((w) => w.projectedBalanceCents));
    lines.push(
      `Previsão de pagamentos (4 semanas): saídas previstas ${formatCents(totalOut4w)}; ` +
        `saldo projetado mínimo ${formatCents(minBalance)}.`,
    );
  }

  if (deadlines.length > 0) {
    lines.push(
      'Próximos prazos fiscais: ' +
        deadlines
          .slice(0, 6)
          .map((d) => `${d.title} (${formatDatePt(d.dueDate)})`)
          .join('; ') +
        '.',
    );
  }

  if (alerts.length > 0) {
    lines.push('Alertas ativos: ' + alerts.map((a) => a.title).join('; ') + '.');
  }

  return lines.join('\n');
}
