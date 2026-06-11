import { create } from 'zustand';
import { deleteDoc, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/app';
import { obligationStatusCol } from '../firebase/firestore';
import type { ObligationStatusMap } from '../types/models';

interface ObligationsState {
  status: ObligationStatusMap;
  loaded: boolean;
  subscribe: (uid: string) => Unsubscribe;
  toggle: (uid: string, key: string) => Promise<void>;
  clearLocal: () => void;
}

/** As chaves contêm ':' (válido em IDs de documento Firestore, sem '/'). */
export const useObligations = create<ObligationsState>((set, get) => ({
  status: {},
  loaded: false,
  subscribe: (uid) =>
    onSnapshot(obligationStatusCol(uid), (snap) => {
      const status: ObligationStatusMap = {};
      for (const d of snap.docs) {
        status[d.id] = (d.data() as { state: 'pending' | 'done' }).state;
      }
      set({ status, loaded: true });
    }),
  toggle: async (uid, key) => {
    const current = get().status[key];
    const ref = doc(db, 'users', uid, 'obligationStatus', key);
    if (current === 'done') {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, { state: 'done' });
    }
  },
  clearLocal: () => set({ status: {}, loaded: false }),
}));
