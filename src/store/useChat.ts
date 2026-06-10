import { create } from 'zustand';
import {
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/app';
import { chatCol } from '../firebase/firestore';
import type { ChatMessage } from '../types/models';

interface ChatState {
  messages: ChatMessage[];
  /** Resposta em streaming ainda não persistida. */
  streamingText: string | null;
  subscribe: (uid: string) => Unsubscribe;
  append: (uid: string, msg: ChatMessage) => Promise<void>;
  setStreaming: (text: string | null) => void;
  clear: (uid: string) => Promise<void>;
  clearLocal: () => void;
}

export const useChat = create<ChatState>((set) => ({
  messages: [],
  streamingText: null,
  subscribe: (uid) =>
    onSnapshot(chatCol(uid), (snap) => {
      const msgs = snap.docs
        .map((d) => ({ ...(d.data() as Omit<ChatMessage, 'id'>), id: d.id }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      set({ messages: msgs });
    }),
  append: async (uid, msg) => {
    const { id, ...data } = msg;
    await setDoc(doc(db, 'users', uid, 'chat', id), data);
  },
  setStreaming: (text) => set({ streamingText: text }),
  clear: async (uid) => {
    const snap = await getDocs(chatCol(uid));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    set({ messages: [] });
  },
  clearLocal: () => set({ messages: [], streamingText: null }),
}));
