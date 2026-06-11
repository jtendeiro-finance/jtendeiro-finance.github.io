import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/app';
import type { ChatMessage } from '../../types/models';

export interface ChatPayload {
  context: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export interface ProcessInvoiceResult {
  ok: boolean;
}

export function toApiMessages(history: ChatMessage[], limit = 12): ChatPayload['messages'] {
  return history.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
}

function mapFunctionsError(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  const message = (e as { message?: string }).message ?? '';
  if (code.includes('unauthenticated')) return 'Sessão expirada — inicie sessão novamente.';
  if (code.includes('resource-exhausted'))
    return 'Limite diário de pedidos de IA atingido. Tente novamente amanhã.';
  if (code.includes('failed-precondition'))
    // A function envia uma mensagem específica (chave inválida, sem créditos…).
    return message || 'O serviço de IA ainda não está configurado (ver SETUP.md).';
  if (code.includes('invalid-argument')) return 'Pedido inválido.';
  if (code.includes('not-found')) return 'Função não encontrada — faça o deploy das functions.';
  if (code.includes('internal') && message && !/^internal$/i.test(message)) return message;
  return 'Ocorreu um erro no serviço de IA. Tente novamente.';
}

/**
 * Conversa com o CFO via Cloud Function (streaming).
 * Devolve o texto final; onDelta é chamado por cada fragmento recebido.
 */
export async function streamCfoChat(
  payload: ChatPayload,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const callable = httpsCallable<ChatPayload, string>(functions, 'cfoChat');
  try {
    const { stream, data } = await callable.stream(payload, { signal });
    for await (const chunk of stream) {
      if (typeof chunk === 'string') onDelta(chunk);
    }
    return await data;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error(mapFunctionsError(e));
  }
}

/** Gera o relatório mensal estruturado ("Análise do CFO"). */
export async function streamCfoReport(
  context: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const callable = httpsCallable<{ context: string }, string>(functions, 'cfoReport');
  try {
    const { stream, data } = await callable.stream({ context }, { signal });
    for await (const chunk of stream) {
      if (typeof chunk === 'string') onDelta(chunk);
    }
    return await data;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error(mapFunctionsError(e));
  }
}

/** Pede a extração por IA de uma fatura carregada no Storage. */
export async function requestInvoiceProcessing(invoiceId: string): Promise<void> {
  const callable = httpsCallable<{ invoiceId: string }, ProcessInvoiceResult>(
    functions,
    'processInvoice',
  );
  try {
    await callable({ invoiceId });
  } catch (e) {
    throw new Error(mapFunctionsError(e));
  }
}
