import type {
  FiscalObligation,
  ObligationDefinition,
  ObligationId,
} from '../../types/models';
import { monthLabelPt, toIso } from '../dates';

function occ(
  id: ObligationId,
  title: string,
  description: string,
  dueDate: string,
  periodLabel?: string,
): FiscalObligation {
  return { key: `${id}:${dueDate}`, obligationId: id, title, description, dueDate, periodLabel };
}

/** Para cada mês do ano, devolve uma ocorrência no dia indicado, referente ao mês anterior. */
function monthlyOnDay(
  id: ObligationId,
  title: string,
  description: string,
  year: number,
  day: number,
): FiscalObligation[] {
  const out: FiscalObligation[] = [];
  for (let m = 1; m <= 12; m++) {
    const refKey = m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`;
    out.push(
      occ(id, title, description, toIso(year, m, day), `ref. ${monthLabelPt(refKey)}`),
    );
  }
  return out;
}

const QUARTER_LABELS = ['1.º trimestre', '2.º trimestre', '3.º trimestre', '4.º trimestre'];

/**
 * Catálogo das obrigações fiscais portuguesas relevantes para PMEs.
 * As datas são as regras gerais em vigor; feriados/fins de semana não são ajustados
 * (a AT difere o prazo para o dia útil seguinte — o aviso aparece sempre antes).
 */
export const OBLIGATION_DEFINITIONS: ObligationDefinition[] = [
  {
    id: 'iva-declaracao',
    title: 'Declaração periódica de IVA',
    description:
      'Entrega da declaração periódica de IVA no Portal das Finanças (art. 41.º CIVA).',
    appliesTo: (p) => p.ivaRegime !== 'isencao53',
    occurrences: (p, year) => {
      const out: FiscalObligation[] = [];
      if (p.ivaRegime === 'mensal') {
        // Até dia 20 do 2.º mês seguinte ao período.
        for (let m = 1; m <= 12; m++) {
          const refMonth = m - 2 <= 0 ? m + 10 : m - 2;
          const refYear = m - 2 <= 0 ? year - 1 : year;
          out.push(
            occ(
              'iva-declaracao',
              'Declaração periódica de IVA (mensal)',
              'Entrega da declaração periódica de IVA — regime mensal.',
              toIso(year, m, 20),
              `ref. ${monthLabelPt(`${refYear}-${String(refMonth).padStart(2, '0')}`)}`,
            ),
          );
        }
      } else {
        // Trimestral: até dia 20 do 2.º mês após o fim do trimestre.
        // T1→20 mai, T2→20 ago, T3→20 nov, T4→20 fev do ano seguinte (gerada no próprio ano para T4 ano-1).
        const map: { month: number; quarter: number; refYear: (y: number) => number }[] = [
          { month: 2, quarter: 3, refYear: (y) => y - 1 }, // T4 do ano anterior
          { month: 5, quarter: 0, refYear: (y) => y },
          { month: 8, quarter: 1, refYear: (y) => y },
          { month: 11, quarter: 2, refYear: (y) => y },
        ];
        for (const { month, quarter, refYear } of map) {
          out.push(
            occ(
              'iva-declaracao',
              'Declaração periódica de IVA (trimestral)',
              'Entrega da declaração periódica de IVA — regime trimestral.',
              toIso(year, month, 20),
              `${QUARTER_LABELS[quarter]} de ${refYear(year)}`,
            ),
          );
        }
      }
      return out;
    },
  },
  {
    id: 'iva-pagamento',
    title: 'Pagamento do IVA',
    description: 'Pagamento do IVA apurado na declaração periódica (até dia 25).',
    appliesTo: (p) => p.ivaRegime !== 'isencao53',
    occurrences: (p, year) => {
      const months = p.ivaRegime === 'mensal' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [2, 5, 8, 11];
      return months.map((m) =>
        occ(
          'iva-pagamento',
          'Pagamento do IVA',
          'Pagamento do IVA apurado na declaração periódica.',
          toIso(year, m, 25),
        ),
      );
    },
  },
  {
    id: 'efatura',
    title: 'Comunicação de faturas (e-Fatura)',
    description:
      'Comunicação à AT das faturas emitidas no mês anterior (SAF-T de faturação), até dia 5.',
    appliesTo: () => true,
    occurrences: (_p, year) =>
      monthlyOnDay(
        'efatura',
        'Comunicação de faturas (e-Fatura)',
        'Comunicação das faturas emitidas no mês anterior à AT.',
        year,
        5,
      ),
  },
  {
    id: 'dmr',
    title: 'DMR — Declaração Mensal de Remunerações',
    description: 'Entrega da DMR (AT) relativa às remunerações do mês anterior, até dia 10.',
    appliesTo: (p) => p.employees > 0,
    occurrences: (_p, year) =>
      monthlyOnDay(
        'dmr',
        'DMR — Declaração Mensal de Remunerações',
        'Declaração das remunerações pagas e retenções efetuadas (AT).',
        year,
        10,
      ),
  },
  {
    id: 'ss-declaracao',
    title: 'Segurança Social — declaração de remunerações',
    description: 'Entrega da declaração de remunerações na Segurança Social Direta, até dia 10.',
    appliesTo: (p) => p.employees > 0,
    occurrences: (_p, year) =>
      monthlyOnDay(
        'ss-declaracao',
        'Segurança Social — declaração de remunerações',
        'Declaração mensal de remunerações dos trabalhadores (SS Direta).',
        year,
        10,
      ),
  },
  {
    id: 'ss-pagamento',
    title: 'Segurança Social — pagamento de contribuições (TSU)',
    description:
      'Pagamento das contribuições (TSU) entre os dias 10 e 20 do mês seguinte.',
    appliesTo: (p) => p.employees > 0,
    occurrences: (_p, year) =>
      monthlyOnDay(
        'ss-pagamento',
        'Segurança Social — pagamento de contribuições (TSU)',
        'Pagamento das contribuições à Segurança Social (janela de 10 a 20).',
        year,
        20,
      ),
  },
  {
    id: 'retencoes-fonte',
    title: 'Retenções na fonte (IRS/IRC)',
    description:
      'Entrega das retenções na fonte de IRS/IRC do mês anterior, até dia 20.',
    appliesTo: () => true,
    occurrences: (_p, year) =>
      monthlyOnDay(
        'retencoes-fonte',
        'Retenções na fonte (IRS/IRC)',
        'Entrega à AT das retenções na fonte efetuadas no mês anterior.',
        year,
        20,
      ),
  },
  {
    id: 'modelo22',
    title: 'Modelo 22 (IRC)',
    description: 'Declaração anual de rendimentos IRC — até 31 de maio.',
    appliesTo: (p) => p.incomeTax === 'IRC',
    occurrences: (_p, year) => [
      occ(
        'modelo22',
        'Modelo 22 (IRC)',
        'Entrega da declaração de rendimentos Modelo 22 relativa ao exercício anterior.',
        toIso(year, 5, 31),
        `exercício de ${year - 1}`,
      ),
    ],
  },
  {
    id: 'ies',
    title: 'IES — Informação Empresarial Simplificada',
    description: 'Entrega da IES/Declaração Anual — até 15 de julho.',
    appliesTo: () => true,
    occurrences: (_p, year) => [
      occ(
        'ies',
        'IES — Informação Empresarial Simplificada',
        'Entrega da IES relativa ao exercício anterior.',
        toIso(year, 7, 15),
        `exercício de ${year - 1}`,
      ),
    ],
  },
  {
    id: 'pagamento-conta-irc',
    title: 'Pagamento por conta (IRC)',
    description: 'Pagamentos por conta do IRC — julho, setembro e 15 de dezembro.',
    appliesTo: (p) => p.incomeTax === 'IRC',
    occurrences: (_p, year) => [
      occ('pagamento-conta-irc', '1.º pagamento por conta (IRC)', 'Primeiro pagamento por conta do IRC.', toIso(year, 7, 31)),
      occ('pagamento-conta-irc', '2.º pagamento por conta (IRC)', 'Segundo pagamento por conta do IRC.', toIso(year, 9, 30)),
      occ('pagamento-conta-irc', '3.º pagamento por conta (IRC)', 'Terceiro pagamento por conta do IRC.', toIso(year, 12, 15)),
    ],
  },
  {
    id: 'modelo10',
    title: 'Modelo 10',
    description:
      'Declaração de rendimentos e retenções não abrangidos pela DMR — até 10 de fevereiro.',
    appliesTo: () => true,
    occurrences: (_p, year) => [
      occ(
        'modelo10',
        'Modelo 10',
        'Declaração anual de rendimentos e retenções (ano anterior).',
        toIso(year, 2, 10),
        `ref. ${year - 1}`,
      ),
    ],
  },
  {
    id: 'inventarios',
    title: 'Comunicação de inventários',
    description: 'Comunicação de inventários à AT — até 31 de janeiro.',
    appliesTo: () => true,
    occurrences: (_p, year) => [
      occ(
        'inventarios',
        'Comunicação de inventários',
        'Comunicação à AT dos inventários existentes a 31 de dezembro.',
        toIso(year, 1, 31),
        `existências a 31/12/${year - 1}`,
      ),
    ],
  },
  {
    id: 'irs-modelo3',
    title: 'IRS — Modelo 3',
    description: 'Entrega da declaração de IRS (ENI) — de 1 de abril a 30 de junho.',
    appliesTo: (p) => p.legalForm === 'ENI' && p.incomeTax === 'IRS',
    occurrences: (_p, year) => [
      occ(
        'irs-modelo3',
        'IRS — Modelo 3',
        'Entrega da declaração de IRS (janela de 1 de abril a 30 de junho).',
        toIso(year, 6, 30),
        `rendimentos de ${year - 1}`,
      ),
    ],
  },
  {
    id: 'subsidio-ferias',
    title: 'Subsídio de férias',
    description: 'Lembrete: pagamento do subsídio de férias aos trabalhadores.',
    appliesTo: (p) => p.employees > 0,
    occurrences: (_p, year) => [
      occ(
        'subsidio-ferias',
        'Subsídio de férias',
        'Pagamento do subsídio de férias (regra geral, antes do gozo de férias).',
        toIso(year, 6, 15),
      ),
    ],
  },
  {
    id: 'subsidio-natal',
    title: 'Subsídio de Natal',
    description: 'Lembrete: pagamento do subsídio de Natal até 15 de dezembro.',
    appliesTo: (p) => p.employees > 0,
    occurrences: (_p, year) => [
      occ(
        'subsidio-natal',
        'Subsídio de Natal',
        'Pagamento do subsídio de Natal aos trabalhadores (até 15 de dezembro).',
        toIso(year, 12, 1),
      ),
    ],
  },
];
