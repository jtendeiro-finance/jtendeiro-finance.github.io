import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from './app';
import type {
  ChatMessage,
  CompanyProfile,
  Invoice,
  Transaction,
} from '../types/models';

export function userDoc(uid: string): DocumentReference {
  return doc(db, 'users', uid);
}

export function transactionsCol(uid: string): CollectionReference {
  return collection(db, 'users', uid, 'transactions');
}

export function invoicesCol(uid: string): CollectionReference {
  return collection(db, 'users', uid, 'invoices');
}

export function obligationStatusCol(uid: string): CollectionReference {
  return collection(db, 'users', uid, 'obligationStatus');
}

export function chatCol(uid: string): CollectionReference {
  return collection(db, 'users', uid, 'chat');
}

/** Remove campos undefined (o Firestore rejeita-os). */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

export type ProfileDoc = CompanyProfile;
export type TransactionDoc = Transaction;
export type InvoiceDoc = Invoice;
export type ChatDoc = ChatMessage;
