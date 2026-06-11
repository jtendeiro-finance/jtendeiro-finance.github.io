import { deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/app';
import {
  chatCol,
  invoicesCol,
  obligationStatusCol,
  transactionsCol,
} from '../../firebase/firestore';
import type {
  BackupEnvelope,
  ChatMessage,
  CompanyProfile,
  Invoice,
  ObligationStatusMap,
  Transaction,
} from '../../types/models';

export async function buildBackup(
  uid: string,
  profile: CompanyProfile | null,
): Promise<BackupEnvelope> {
  const [txSnap, invSnap, oblSnap, chatSnap] = await Promise.all([
    getDocs(transactionsCol(uid)),
    getDocs(invoicesCol(uid)),
    getDocs(obligationStatusCol(uid)),
    getDocs(chatCol(uid)),
  ]);

  const obligationStatus: ObligationStatusMap = {};
  for (const d of oblSnap.docs) {
    obligationStatus[d.id] = (d.data() as { state: 'pending' | 'done' }).state;
  }

  return {
    app: 'assistente-cfo',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    transactions: txSnap.docs.map((d) => ({ ...(d.data() as Omit<Transaction, 'id'>), id: d.id })),
    invoices: invSnap.docs.map((d) => ({ ...(d.data() as Omit<Invoice, 'id'>), id: d.id })),
    obligationStatus,
    chat: chatSnap.docs.map((d) => ({ ...(d.data() as Omit<ChatMessage, 'id'>), id: d.id })),
  };
}

export function downloadBackup(envelope: BackupEnvelope): void {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `assistente-cfo-backup-${envelope.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): BackupEnvelope {
  const data = JSON.parse(text) as Partial<BackupEnvelope>;
  if (data.app !== 'assistente-cfo' || data.version !== 1) {
    throw new Error('Ficheiro de backup inválido ou de versão não suportada.');
  }
  return {
    app: 'assistente-cfo',
    version: 1,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    profile: data.profile ?? null,
    transactions: data.transactions ?? [],
    invoices: data.invoices ?? [],
    obligationStatus: data.obligationStatus ?? {},
    chat: data.chat ?? [],
  };
}

/** Repõe os dados de um backup (substitui documentos com o mesmo id; não apaga extra). */
export async function restoreBackup(uid: string, envelope: BackupEnvelope): Promise<void> {
  if (envelope.profile) {
    await setDoc(doc(db, 'users', uid), envelope.profile);
  }

  const writeAll = async (
    col: 'transactions' | 'invoices' | 'chat',
    items: { id: string }[],
  ) => {
    for (let i = 0; i < items.length; i += 450) {
      const batch = writeBatch(db);
      for (const item of items.slice(i, i + 450)) {
        const { id, ...data } = item as { id: string } & Record<string, unknown>;
        const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
        batch.set(doc(db, 'users', uid, col, id), clean);
      }
      await batch.commit();
    }
  };

  await writeAll('transactions', envelope.transactions);
  await writeAll('invoices', envelope.invoices);
  await writeAll('chat', envelope.chat);

  const statusEntries = Object.entries(envelope.obligationStatus);
  for (let i = 0; i < statusEntries.length; i += 450) {
    const batch = writeBatch(db);
    for (const [key, state] of statusEntries.slice(i, i + 450)) {
      batch.set(doc(db, 'users', uid, 'obligationStatus', key), { state });
    }
    await batch.commit();
  }
}

/** Apaga todos os dados do utilizador no Firestore (não remove os PDFs do Storage). */
export async function clearAllData(uid: string): Promise<void> {
  for (const col of [transactionsCol(uid), invoicesCol(uid), obligationStatusCol(uid), chatCol(uid)]) {
    const snap = await getDocs(col);
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + 450)) batch.delete(d.ref);
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'users', uid));
}
