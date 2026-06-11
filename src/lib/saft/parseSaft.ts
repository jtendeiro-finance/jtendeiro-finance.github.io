import type { Transaction } from '../../types/models';
import { parsePtAmountToCents } from '../money';
import { parsePtDate } from '../dates';

export interface SaftParty {
  id: string;
  name: string;
}

export interface SaftImportResult {
  invoices: Omit<Transaction, 'id'>[];
  customers: SaftParty[];
  suppliers: SaftParty[];
  warnings: string[];
}

/** Lê o texto do primeiro descendente com aquele nome local (qualquer namespace). */
function childText(el: Element, localName: string): string | null {
  const nodes = el.getElementsByTagNameNS('*', localName);
  if (nodes.length === 0) return null;
  return nodes[0].textContent?.trim() ?? null;
}

function directChild(el: Element, localName: string): Element | null {
  for (const child of Array.from(el.children)) {
    if (child.localName === localName) return child;
  }
  return null;
}

function amountToCents(raw: string | null): number | null {
  if (raw == null) return null;
  // SAF-T usa ponto decimal ("1234.56").
  const n = Number(raw);
  if (Number.isFinite(n)) return Math.round(n * 100);
  return parsePtAmountToCents(raw);
}

/**
 * Extrai faturas de venda (SourceDocuments > SalesInvoices) de um SAF-T (PT).
 * Tolerante à versão do namespace (PT_1.04_01, etc.) através de queries com wildcard.
 */
export function parseSaftXml(xmlText: string): SaftImportResult {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Ficheiro XML inválido — não foi possível interpretar o SAF-T.');
  }

  const customers: SaftParty[] = [];
  const customerNames = new Map<string, string>();
  for (const c of Array.from(doc.getElementsByTagNameNS('*', 'Customer'))) {
    const id = childText(c, 'CustomerID');
    const name = childText(c, 'CompanyName');
    if (id && name) {
      customers.push({ id, name });
      customerNames.set(id, name);
    }
  }

  const suppliers: SaftParty[] = [];
  for (const s of Array.from(doc.getElementsByTagNameNS('*', 'Supplier'))) {
    const id = childText(s, 'SupplierID');
    const name = childText(s, 'CompanyName');
    if (id && name) suppliers.push({ id, name });
  }

  const invoices: Omit<Transaction, 'id'>[] = [];
  const importedAt = new Date().toISOString();

  const salesInvoices = doc.getElementsByTagNameNS('*', 'SalesInvoices');
  const root = salesInvoices.length > 0 ? salesInvoices[0] : null;
  const invoiceEls = root ? Array.from(root.getElementsByTagNameNS('*', 'Invoice')) : [];

  for (const inv of invoiceEls) {
    const invoiceNo = childText(inv, 'InvoiceNo') ?? undefined;
    const dateRaw = childText(inv, 'InvoiceDate');
    const date = dateRaw ? parsePtDate(dateRaw) : null;
    if (!date) {
      warnings.push(`Fatura ${invoiceNo ?? '(sem número)'} sem data válida — ignorada.`);
      continue;
    }

    const invoiceType = childText(inv, 'InvoiceType') ?? 'FT';
    const status = childText(inv, 'InvoiceStatus');
    if (status === 'A') {
      warnings.push(`Fatura ${invoiceNo ?? ''} anulada — ignorada.`);
      continue;
    }

    const totals = directChild(inv, 'DocumentTotals') ?? inv;
    const gross = amountToCents(childText(totals, 'GrossTotal'));
    const tax = amountToCents(childText(totals, 'TaxPayable')) ?? 0;
    if (gross === null) {
      warnings.push(`Fatura ${invoiceNo ?? ''} sem total — ignorada.`);
      continue;
    }

    const customerId = childText(inv, 'CustomerID');
    const counterparty = customerId ? customerNames.get(customerId) ?? customerId : undefined;

    // Notas de crédito reduzem a receita.
    const sign = invoiceType === 'NC' ? -1 : 1;
    if (invoiceType === 'NC') {
      warnings.push(`Nota de crédito ${invoiceNo ?? ''} importada com sinal negativo.`);
    }

    invoices.push({
      date,
      description: `Fatura ${invoiceNo ?? ''}${counterparty ? ` — ${counterparty}` : ''}`.trim(),
      amountCents: sign * Math.abs(gross),
      categoryId: 'vendas',
      source: 'saft',
      counterparty,
      vatCents: sign * Math.abs(tax),
      docRef: invoiceNo,
      importedAt,
    });
  }

  return { invoices, customers, suppliers, warnings };
}
