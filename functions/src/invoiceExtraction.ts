/** Esquema de saída estruturada para a extração de faturas por IA. */
export const INVOICE_SCHEMA = {
  type: 'object',
  properties: {
    direction: {
      type: 'string',
      enum: ['payable', 'receivable'],
      description:
        'payable = fatura de fornecedor (a pagar); receivable = fatura emitida a cliente (a receber)',
    },
    counterparty: { type: 'string', description: 'Nome do fornecedor ou cliente' },
    nif: { type: ['string', 'null'], description: 'NIF/NIPC português (9 dígitos), se visível' },
    number: { type: ['string', 'null'], description: 'Número da fatura (ex.: FT 2026/123)' },
    issueDate: { type: 'string', description: 'Data de emissão em formato ISO yyyy-mm-dd' },
    dueDate: { type: ['string', 'null'], description: 'Data de vencimento ISO, se indicada' },
    descriptionSummary: {
      type: 'string',
      description: 'Resumo curto (máx. 80 caracteres) do que foi faturado, em português',
    },
    netCents: { type: 'integer', description: 'Total sem IVA, em cêntimos de euro' },
    vatCents: { type: 'integer', description: 'Total de IVA, em cêntimos de euro' },
    grossCents: { type: 'integer', description: 'Total com IVA, em cêntimos de euro' },
    suggestedCategoryId: {
      type: 'string',
      enum: [
        'vendas', 'prestacao-servicos', 'subsidios', 'outros-rendimentos',
        'fornecedores', 'rendas', 'salarios', 'seguranca-social', 'impostos',
        'combustivel', 'marketing', 'seguros', 'bancos', 'equipamento',
        'comunicacoes', 'agua-energia', 'software', 'deslocacoes', 'contabilidade',
        'outros-gastos',
      ],
      description: 'Categoria contabilística mais adequada',
    },
    confidence: {
      type: 'number',
      description: 'Confiança global da extração, entre 0 e 1',
    },
  },
  required: [
    'direction', 'counterparty', 'issueDate', 'descriptionSummary',
    'netCents', 'vatCents', 'grossCents', 'suggestedCategoryId', 'confidence',
  ],
  additionalProperties: false,
} as const;

export const EXTRACTION_PROMPT = `Analisa este documento (fatura, fatura-recibo ou recibo português).
Extrai os dados pedidos no esquema. Regras:
- Montantes em cêntimos de euro (ex.: 123,45 € → 12345). Se o IVA não estiver discriminado mas a taxa for visível, calcula-o; caso contrário usa 0 e reduz a confiança.
- Se a empresa destinatária for quem recebe o documento de um fornecedor, é "payable". Se for uma fatura emitida a um cliente, é "receivable". Na dúvida, "payable".
- Datas em formato ISO yyyy-mm-dd. Não inventes dados ilegíveis — usa null e baixa a confiança.`;

export interface InvoiceExtraction {
  direction: 'payable' | 'receivable';
  counterparty: string;
  nif: string | null;
  number: string | null;
  issueDate: string;
  dueDate: string | null;
  descriptionSummary: string;
  netCents: number;
  vatCents: number;
  grossCents: number;
  suggestedCategoryId: string;
  confidence: number;
}
