import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/app';

interface AuthState {
  user: User | null;
  /** true enquanto o estado inicial de autenticação não é conhecido */
  loading: boolean;
  error: string | null;
  init: () => void;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

function mapAuthError(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email ou palavra-passe incorretos.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com este email.';
    case 'auth/weak-password':
      return 'A palavra-passe deve ter pelo menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/popup-closed-by-user':
      return 'Início de sessão cancelado.';
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado no Firebase (ver SETUP.md).';
    default:
      return 'Não foi possível iniciar sessão. Tente novamente.';
  }
}

let initialized = false;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  init: () => {
    if (initialized) return;
    initialized = true;
    onAuthStateChanged(auth, (user) => set({ user, loading: false }));
  },
  loginGoogle: async () => {
    set({ error: null });
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      set({ error: mapAuthError(e) });
    }
  },
  loginEmail: async (email, password) => {
    set({ error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      set({ error: mapAuthError(e) });
    }
  },
  registerEmail: async (email, password) => {
    set({ error: null });
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      set({ error: mapAuthError(e) });
    }
  },
  logout: async () => {
    await signOut(auth);
  },
}));
