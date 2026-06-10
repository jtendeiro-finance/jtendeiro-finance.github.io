import type { Category } from '../../types/models';

export const CATEGORIES: Category[] = [
  // Receitas
  { id: 'vendas', label: 'Vendas', kind: 'income', keywords: ['venda', 'fatura fr', 'fatura ft', 'tpa', 'multibanco vendas'] },
  { id: 'prestacao-servicos', label: 'Prestação de serviços', kind: 'income', keywords: ['prestacao de servicos', 'prestação de serviços', 'honorario', 'avenca', 'consultoria recebida'] },
  { id: 'subsidios', label: 'Subsídios e apoios', kind: 'income', keywords: ['subsidio', 'iapmei', 'iefp', 'apoio', 'incentivo', 'compete'] },
  { id: 'outros-rendimentos', label: 'Outros rendimentos', kind: 'income', keywords: ['juros recebidos', 'reembolso'] },
  // Despesas
  { id: 'fornecedores', label: 'Fornecedores', kind: 'expense', keywords: ['fornecedor', 'compra', 'mercadoria', 'makro', 'recheio'] },
  { id: 'rendas', label: 'Rendas', kind: 'expense', keywords: ['renda', 'arrendamento', 'aluguer'] },
  { id: 'salarios', label: 'Salários', kind: 'expense', keywords: ['salario', 'ordenado', 'vencimento', 'remuneracao', 'subsidio ferias', 'subsidio natal'] },
  { id: 'seguranca-social', label: 'Segurança Social', kind: 'expense', keywords: ['seg. social', 'seguranca social', 'segurança social', 'tsu', 'ss tesouraria', 'igfss'] },
  { id: 'impostos', label: 'Impostos', kind: 'expense', keywords: ['at - ', 'autoridade tributaria', 'iva pagamento', 'irc', 'imposto', 'dgci', 'financas', 'imi', 'iuc'] },
  { id: 'combustivel', label: 'Combustível', kind: 'expense', keywords: ['galp', 'bp ', 'repsol', 'prio', 'cepsa', 'combust', 'gasolina', 'gasoleo'] },
  { id: 'marketing', label: 'Marketing e publicidade', kind: 'expense', keywords: ['google ads', 'facebook', 'meta ads', 'instagram', 'publicidade', 'marketing'] },
  { id: 'seguros', label: 'Seguros', kind: 'expense', keywords: ['seguro', 'fidelidade', 'tranquilidade', 'allianz', 'ageas', 'zurich'] },
  { id: 'bancos', label: 'Bancos e comissões', kind: 'expense', keywords: ['comissao', 'comissão', 'manutencao conta', 'manutenção conta', 'imposto selo', 'despesas bancarias', 'tarifa'] },
  { id: 'equipamento', label: 'Equipamento', kind: 'expense', keywords: ['equipamento', 'worten', 'fnac', 'leroy', 'aki ', 'ferramenta', 'maquina'] },
  { id: 'comunicacoes', label: 'Comunicações', kind: 'expense', keywords: ['meo', 'nos ', 'vodafone', 'telecom', 'internet', 'telemovel'] },
  { id: 'agua-energia', label: 'Eletricidade e água', kind: 'expense', keywords: ['edp', 'endesa', 'galp power', 'iberdrola', 'goldenergy', 'aguas', 'águas', 'epal', 'luz ', 'eletricidade'] },
  { id: 'software', label: 'Software e subscrições', kind: 'expense', keywords: ['software', 'subscricao', 'subscrição', 'microsoft', 'adobe', 'dropbox', 'zoom', 'slack', 'github', 'aws', 'moloni', 'toconline', 'sage', 'primavera'] },
  { id: 'deslocacoes', label: 'Deslocações e estadas', kind: 'expense', keywords: ['hotel', 'voo', 'tap ', 'ryanair', 'easyjet', 'comboio', 'cp ', 'uber', 'bolt', 'taxi', 'portagem', 'via verde'] },
  { id: 'contabilidade', label: 'Contabilidade e jurídico', kind: 'expense', keywords: ['contabilidade', 'contabilista', 'toc ', 'advogado', 'notario', 'notário', 'cartorio'] },
  { id: 'outros-gastos', label: 'Outros gastos', kind: 'expense', keywords: [] },
];

export const CATEGORY_BY_ID: ReadonlyMap<string, Category> = new Map(
  CATEGORIES.map((c) => [c.id, c]),
);

export function categoryLabel(id: string): string {
  return CATEGORY_BY_ID.get(id)?.label ?? id;
}

export const INCOME_FALLBACK = 'outros-rendimentos';
export const EXPENSE_FALLBACK = 'outros-gastos';
