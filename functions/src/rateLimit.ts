import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const DAILY_CHAT_LIMIT = 50;
const DAILY_EXTRACTION_LIMIT = 20;

type UsageField = 'aiRequests' | 'invoiceExtractions';

/**
 * Limite diário por utilizador, contado num doc users/{uid}/usage/{yyyy-mm-dd}.
 * As regras do Firestore impedem o cliente de escrever nesta subcoleção;
 * o Admin SDK (aqui) ignora as regras.
 */
export async function enforceDailyLimit(uid: string, field: UsageField): Promise<void> {
  const limit = field === 'aiRequests' ? DAILY_CHAT_LIMIT : DAILY_EXTRACTION_LIMIT;
  const day = new Date().toISOString().slice(0, 10);
  const ref = getFirestore().doc(`users/${uid}/usage/${day}`);

  const exceeded = await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.data()?.[field] as number | undefined) ?? 0;
    if (current >= limit) return true;
    tx.set(ref, { [field]: FieldValue.increment(1) }, { merge: true });
    return false;
  });

  if (exceeded) {
    throw new HttpsError(
      'resource-exhausted',
      'Limite diário de pedidos de IA atingido. Tente novamente amanhã.',
    );
  }
}
