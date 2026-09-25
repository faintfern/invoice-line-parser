import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceTotal } from "./index.js";
import type { LineItem } from "./index.js";

function item(amount: number): LineItem {
  return { line: 1, quantity: 1, description: "item", unitPrice: amount, amount };
}

test("sums item amounts", () => {
  assert.equal(invoiceTotal([item(10), item(5.5)]), 15.5);
});

test("returns zero for an empty list", () => {
  assert.equal(invoiceTotal([]), 0);
});

test("rounds away floating point drift from summed amounts", () => {
  // 0.1 + 0.2 is 0.30000000000000004 in floating point.
  assert.equal(invoiceTotal([item(0.1), item(0.2)]), 0.3);
});
