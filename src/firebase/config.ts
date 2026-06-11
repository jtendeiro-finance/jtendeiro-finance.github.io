/**
 * Configuração web do Firebase.
 *
 * ⚠️ PREENCHER após criar o projeto Firebase (ver SETUP.md).
 * Estes valores são públicos por natureza (identificam o projeto; a segurança
 * é garantida pelas regras do Firestore/Storage e pela autenticação).
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCb-LrxffltVoWCBgCbybA0B60NaFcoSrI',
  authDomain: 'cfo4you-281c7.firebaseapp.com',
  projectId: 'cfo4you-281c7',
  storageBucket: 'cfo4you-281c7.firebasestorage.app',
  messagingSenderId: '1087806620879',
  appId: '1:1087806620879:web:51468882e55bcb7a4023ba',
};

/** Verdadeiro quando a configuração ainda não foi preenchida. */
export const isFirebaseConfigured = firebaseConfig.projectId !== 'COLOQUE_AQUI';

/** Região das Cloud Functions (alinhar com o deploy em functions/src/index.ts). */
export const FUNCTIONS_REGION = 'europe-west1';
