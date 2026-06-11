import { create } from 'zustand';
import { getDoc, setDoc } from 'firebase/firestore';
import { stripUndefined, userDoc } from '../firebase/firestore';
import type { CompanyProfile } from '../types/models';

interface ProfileState {
  profile: CompanyProfile | null;
  loaded: boolean;
  load: (uid: string) => Promise<void>;
  save: (uid: string, profile: CompanyProfile) => Promise<void>;
  clearLocal: () => void;
}

export const useProfile = create<ProfileState>((set) => ({
  profile: null,
  loaded: false,
  load: async (uid) => {
    const snap = await getDoc(userDoc(uid));
    const data = snap.exists() ? (snap.data() as Partial<CompanyProfile>) : null;
    set({
      profile: data && data.name ? (data as CompanyProfile) : null,
      loaded: true,
    });
  },
  save: async (uid, profile) => {
    await setDoc(userDoc(uid), stripUndefined({ ...profile }), { merge: true });
    set({ profile });
  },
  clearLocal: () => set({ profile: null, loaded: false }),
}));
