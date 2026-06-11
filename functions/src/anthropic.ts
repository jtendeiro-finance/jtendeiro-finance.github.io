import Anthropic from '@anthropic-ai/sdk';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';

export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

/** Modelo para chat e relatórios do CFO (raciocínio estratégico). */
export const MODEL = 'claude-opus-4-8';

/** Modelo para extração de faturas (tarefa estruturada — mais rápido e barato). */
export const EXTRACTION_MODEL = 'claude-sonnet-4-6';

export function getClient(): Anthropic {
  const key = anthropicApiKey.value();
  if (!key) {
    throw new HttpsError('failed-precondition', 'ANTHROPIC_API_KEY não configurada.');
  }
  return new Anthropic({ apiKey: key });
}

/** Converte erros da API Anthropic em HttpsError com mensagens PT. */
export function mapAnthropicError(e: unknown): HttpsError {
  logger.error('Erro na chamada à API Anthropic', e);
  if (e instanceof Anthropic.AuthenticationError) {
    return new HttpsError('failed-precondition', 'Chave Anthropic inválida (configuração do servidor).');
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new HttpsError('resource-exhausted', 'O serviço de IA está sobrecarregado. Tente daqui a pouco.');
  }
  if (e instanceof Anthropic.APIError) {
    const detail = typeof e.message === 'string' ? e.message : '';
    if (/credit balance|billing|purchase/i.test(detail)) {
      return new HttpsError(
        'failed-precondition',
        'A conta Anthropic não tem créditos. Adicione créditos em platform.claude.com → Billing.',
      );
    }
    return new HttpsError('internal', `Erro do serviço de IA (${e.status ?? '?'}): ${detail.slice(0, 300)}`);
  }
  const msg = e instanceof Error ? e.message : String(e);
  return new HttpsError('internal', `Erro inesperado no serviço de IA: ${msg.slice(0, 300)}`);
}
