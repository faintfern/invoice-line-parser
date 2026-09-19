export {
  parseInvoice,
  parseInvoiceOrThrow,
  SourceError,
  InvoiceParseError,
} from "./parser.js";
export type { LineItem, ParseResult, SourceLocation } from "./parser.js";

import type { LineItem } from "./parser.js";

export function invoiceTotal(items: readonly LineItem[]): number {
  const sum = items.reduce((total, item) => total + item.amount, 0);
  return Math.round(sum * 100) / 100;
}
