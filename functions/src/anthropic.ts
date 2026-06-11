import Anthropic from '@anthropic-ai/sdk';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';

export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

export const MODEL = 'claude-opus-4-8';

export function getClient(): Anthropic {
  const key = anthropicApiKey.value();
  if (!key) {
    throw new HttpsError('failed-precondition', 'ANTHROPIC_API_KEY não configurada.');
  }
  return new Anthropic({ apiKey: key });
}

/** Converte erros da API Anthropic em HttpsError com mensagens PT. */
export function mapAnthropicError(e: unknown): HttpsError {
  if (e instanceof Anthropic.AuthenticationError) {
    return new HttpsError('failed-precondition', 'Chave Anthropic inválida (configuração do servidor).');
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new HttpsError('resource-exhausted', 'O serviço de IA está sobrecarregado. Tente daqui a pouco.');
  }
  if (e instanceof Anthropic.APIError) {
    return new HttpsError('internal', `Erro do serviço de IA (${e.status ?? '?'}).`);
  }
  return new HttpsError('internal', 'Erro inesperado no serviço de IA.');
}
