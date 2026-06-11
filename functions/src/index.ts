import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { anthropicApiKey, getClient, mapAnthropicError, MODEL } from './anthropic.js';
import { enforceDailyLimit } from './rateLimit.js';
import { EXTRACTION_PROMPT, INVOICE_SCHEMA, type InvoiceExtraction } from './invoiceExtraction.js';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });

interface ChatPayload {
  context: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

const CFO_SYSTEM_BASE = `És o diretor financeiro (CFO) virtual de uma pequena empresa portuguesa.
Falas português de Portugal, de forma clara, prática e direta — como um CFO experiente a falar com o dono da empresa, que pode não ter formação financeira.
Usa os dados financeiros fornecidos abaixo; cita números concretos em euros. Não inventes dados: se faltarem, di-lo e sugere como obtê-los.
Em temas fiscais portugueses (IVA, IRC, IRS, TSU, prazos), dá orientação geral e recomenda validar com o contabilista certificado.
Sê conciso: respostas curtas com recomendações acionáveis.`;

function buildSystem(context: string): string {
  return `${CFO_SYSTEM_BASE}\n\n=== DADOS ATUAIS DA EMPRESA ===\n${context}`;
}

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  return uid;
}

function validateMessages(messages: unknown): ChatPayload['messages'] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    throw new HttpsError('invalid-argument', 'Mensagens inválidas.');
  }
  for (const m of messages) {
    if (
      typeof m !== 'object' || m === null ||
      !['user', 'assistant'].includes((m as { role?: string }).role ?? '') ||
      typeof (m as { content?: unknown }).content !== 'string' ||
      ((m as { content: string }).content.length > 8000)
    ) {
      throw new HttpsError('invalid-argument', 'Mensagens inválidas.');
    }
  }
  return messages as ChatPayload['messages'];
}

function validateContext(context: unknown): string {
  if (typeof context !== 'string' || context.length > 20000) {
    throw new HttpsError('invalid-argument', 'Contexto inválido.');
  }
  return context;
}

/** Conversa em streaming com o CFO virtual. */
export const cfoChat = onCall<ChatPayload>(
  { secrets: [anthropicApiKey], timeoutSeconds: 120 },
  async (request, response) => {
    const uid = requireAuth(request.auth?.uid);
    const context = validateContext(request.data?.context);
    const messages = validateMessages(request.data?.messages);
    await enforceDailyLimit(uid, 'aiRequests');

    const client = getClient();
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system: buildSystem(context),
        messages,
      });
      let full = '';
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          full += event.delta.text;
          response?.sendChunk(event.delta.text);
        }
      }
      await stream.finalMessage();
      return full;
    } catch (e) {
      throw mapAnthropicError(e);
    }
  },
);

const REPORT_PROMPT = `Com base nos dados da empresa fornecidos no contexto, escreve a "Análise do CFO" deste mês, em markdown, com as secções:
## Resumo executivo
## Receitas e despesas
## Previsão de pagamentos
## Riscos
## Recomendações
## Próximos prazos fiscais
Sê específico e quantitativo (euros, percentagens, datas). Máximo ~500 palavras.`;

/** Relatório mensal estruturado ("Análise do CFO"), em streaming. */
export const cfoReport = onCall<{ context: string }>(
  { secrets: [anthropicApiKey], timeoutSeconds: 180 },
  async (request, response) => {
    const uid = requireAuth(request.auth?.uid);
    const context = validateContext(request.data?.context);
    await enforceDailyLimit(uid, 'aiRequests');

    const client = getClient();
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 3000,
        thinking: { type: 'adaptive' },
        system: buildSystem(context),
        messages: [{ role: 'user', content: REPORT_PROMPT }],
      });
      let full = '';
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          full += event.delta.text;
          response?.sendChunk(event.delta.text);
        }
      }
      await stream.finalMessage();
      return full;
    } catch (e) {
      throw mapAnthropicError(e);
    }
  },
);

/** Extrai os dados de uma fatura (PDF no Storage) com visão + saída estruturada. */
export const processInvoice = onCall<{ invoiceId: string }>(
  { secrets: [anthropicApiKey], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const invoiceId = request.data?.invoiceId;
    if (typeof invoiceId !== 'string' || !/^[\w-]{8,64}$/.test(invoiceId)) {
      throw new HttpsError('invalid-argument', 'invoiceId inválido.');
    }
    await enforceDailyLimit(uid, 'invoiceExtractions');

    const db = getFirestore();
    const invoiceRef = db.doc(`users/${uid}/invoices/${invoiceId}`);
    const snap = await invoiceRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Fatura não encontrada.');
    const storagePath = snap.data()?.storagePath as string | undefined;
    if (!storagePath || !storagePath.startsWith(`users/${uid}/`)) {
      throw new HttpsError('permission-denied', 'Documento inválido.');
    }

    const [pdfBuffer] = await getStorage().bucket().file(storagePath).download();
    if (pdfBuffer.length > 8 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'O PDF é demasiado grande para processar.');
    }

    const client = getClient();
    try {
      const result = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        output_config: {
          format: { type: 'json_schema', schema: INVOICE_SCHEMA as unknown as Record<string, unknown> },
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBuffer.toString('base64'),
                },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });

      const text = result.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') {
        throw new HttpsError('internal', 'A IA não devolveu dados estruturados.');
      }
      const extraction = JSON.parse(text.text) as InvoiceExtraction;

      await invoiceRef.update({
        direction: extraction.direction,
        counterparty: extraction.counterparty ?? '',
        nif: extraction.nif ?? null,
        number: extraction.number ?? null,
        issueDate: extraction.issueDate,
        dueDate: extraction.dueDate ?? null,
        descriptionSummary: extraction.descriptionSummary ?? '',
        netCents: Math.round(extraction.netCents),
        vatCents: Math.round(extraction.vatCents),
        grossCents: Math.round(extraction.grossCents),
        categoryId: extraction.suggestedCategoryId,
        extractionConfidence: Math.max(0, Math.min(1, extraction.confidence)),
        status: 'extracted',
      });
      return { ok: true };
    } catch (e) {
      await invoiceRef.update({ status: 'uploaded' }).catch(() => undefined);
      if (e instanceof HttpsError) throw e;
      throw mapAnthropicError(e);
    }
  },
);
