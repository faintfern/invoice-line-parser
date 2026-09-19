#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseInvoice, invoiceTotal } from "./index.js";

function main(argv: readonly string[]): number {
  const path = argv[2];
  if (!path) {
    console.error("usage: lineitems <invoice-file>");
    return 1;
  }

  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch (err) {
    console.error(`could not read ${path}: ${(err as Error).message}`);
    return 1;
  }

  const { items, errors } = parseInvoice(source);

  for (const error of errors) {
    console.error(error.format());
    console.error("");
  }

  for (const item of items) {
    const qty = item.quantity.toString().padStart(6);
    const desc = item.description.padEnd(32);
    const price = item.unitPrice.toFixed(2).padStart(10);
    const amount = item.amount.toFixed(2).padStart(10);
    console.log(`${qty}  x  ${desc}  @ ${price}  = ${amount}`);
  }

  if (items.length > 0) {
    console.log("");
    console.log(`total: ${invoiceTotal(items).toFixed(2)}`);
  }

  if (errors.length > 0) {
    const noun = errors.length === 1 ? "error" : "errors";
    console.error(`\n${errors.length} ${noun}, ${items.length} line item(s) parsed`);
    return 1;
  }

  return 0;
}

process.exit(main(process.argv));
