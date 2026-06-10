import { create } from 'zustand';
import {
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/app';
import { stripUndefined, transactionsCol } from '../firebase/firestore';
import type { Transaction } from '../types/models';
import { dedupeKey } from '../lib/csv/columnMapping';

interface TransactionsState {
  transactions: Transaction[];
  loaded: boolean;
  subscribe: (uid: string) => Unsubscribe;
  addMany: (uid: string, txs: Omit<Transaction, 'id'>[]) => Promise<{ added: number; skipped: number }>;
  updateCategory: (uid: string, id: string, categoryId: string) => Promise<void>;
  setReconciled: (uid: string, id: string, invoiceId: string | null) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
  clearLocal: () => void;
}

export const useTransactions = create<TransactionsState>((set, get) => ({
  transactions: [],
  loaded: false,
  subscribe: (uid) =>
    onSnapshot(transactionsCol(uid), (snap) => {
      const txs = snap.docs
        .map((d) => ({ ...(d.data() as Omit<Transaction, 'id'>), id: d.id }))
        .sort((a, b) => b.date.localeCompare(a.date));
      set({ transactions: txs, loaded: true });
    }),
  addMany: async (uid, txs) => {
    const existing = new Set(get().transactions.map(dedupeKey));
    const existingDocRefs = new Set(
      get().transactions.filter((t) => t.docRef).map((t) => `${t.source}|${t.docRef}`),
    );
    const fresh = txs.filter((t) => {
      if (t.docRef && existingDocRefs.has(`${t.source}|${t.docRef}`)) return false;
      if (existing.has(dedupeKey(t))) return false;
      existing.add(dedupeKey(t));
      if (t.docRef) existingDocRefs.add(`${t.source}|${t.docRef}`);
      return true;
    });

    // Firestore: máx. 500 operações por batch.
    for (let i = 0; i < fresh.length; i += 450) {
      const batch = writeBatch(db);
      for (const t of fresh.slice(i, i + 450)) {
        const ref = doc(transactionsCol(uid));
        batch.set(ref, stripUndefined({ ...t }));
      }
      await batch.commit();
    }
    return { added: fresh.length, skipped: txs.length - fresh.length };
  },
  updateCategory: async (uid, id, categoryId) => {
    await updateDoc(doc(db, 'users', uid, 'transactions', id), { categoryId });
  },
  setReconciled: async (uid, id, invoiceId) => {
    await updateDoc(doc(db, 'users', uid, 'transactions', id), {
      reconciledInvoiceId: invoiceId ?? null,
    });
  },
  remove: async (uid, id) => {
    await deleteDoc(doc(db, 'users', uid, 'transactions', id));
  },
  clearLocal: () => set({ transactions: [], loaded: false }),
}));
