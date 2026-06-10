import { create } from 'zustand';
import {
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, ref as storageRef } from 'firebase/storage';
import { db, storage } from '../firebase/app';
import { invoicesCol, stripUndefined } from '../firebase/firestore';
import type { Invoice } from '../types/models';

interface InvoicesState {
  invoices: Invoice[];
  loaded: boolean;
  subscribe: (uid: string) => Unsubscribe;
  create: (uid: string, invoice: Invoice) => Promise<void>;
  update: (uid: string, id: string, patch: Partial<Invoice>) => Promise<void>;
  remove: (uid: string, invoice: Invoice) => Promise<void>;
  clearLocal: () => void;
}

export const useInvoices = create<InvoicesState>((set) => ({
  invoices: [],
  loaded: false,
  subscribe: (uid) =>
    onSnapshot(invoicesCol(uid), (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as Omit<Invoice, 'id'>), id: d.id }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      set({ invoices: list, loaded: true });
    }),
  create: async (uid, invoice) => {
    const { id, ...data } = invoice;
    await setDoc(doc(db, 'users', uid, 'invoices', id), stripUndefined(data));
  },
  update: async (uid, id, patch) => {
    await updateDoc(doc(db, 'users', uid, 'invoices', id), stripUndefined({ ...patch }));
  },
  remove: async (uid, invoice) => {
    await deleteDoc(doc(db, 'users', uid, 'invoices', invoice.id));
    try {
      await deleteObject(storageRef(storage, invoice.storagePath));
    } catch {
      // ficheiro pode já não existir
    }
  },
  clearLocal: () => set({ invoices: [], loaded: false }),
}));
