/**
 * Configuração web do Firebase.
 *
 * ⚠️ PREENCHER após criar o projeto Firebase (ver SETUP.md).
 * Estes valores são públicos por natureza (identificam o projeto; a segurança
 * é garantida pelas regras do Firestore/Storage e pela autenticação).
 */
export const firebaseConfig = {
  apiKey: 'COLOQUE_AQUI',
  authDomain: 'COLOQUE_AQUI.firebaseapp.com',
  projectId: 'COLOQUE_AQUI',
  storageBucket: 'COLOQUE_AQUI.firebasestorage.app',
  messagingSenderId: 'COLOQUE_AQUI',
  appId: 'COLOQUE_AQUI',
};

/** Verdadeiro quando a configuração ainda não foi preenchida. */
export const isFirebaseConfigured = firebaseConfig.projectId !== 'COLOQUE_AQUI';

/** Região das Cloud Functions (alinhar com o deploy em functions/src/index.ts). */
export const FUNCTIONS_REGION = 'europe-west1';
