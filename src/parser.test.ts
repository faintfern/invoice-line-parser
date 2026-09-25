import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInvoice, parseInvoiceOrThrow, InvoiceParseError } from "./parser.js";

test("parses a well-formed line item", () => {
  const { items, errors } = parseInvoice("2 x Widget @ 19.99");
  assert.equal(errors.length, 0);
  assert.deepEqual(items, [
    { line: 1, quantity: 2, description: "Widget", unitPrice: 19.99, amount: 39.98 },
  ]);
});

test("ignores blank lines and comment lines", () => {
  const source = [
    "# invoice for September",
    "",
    "2 x Widget @ 19.99",
    "   ",
    "# a trailing note",
  ].join("\n");
  const { items, errors } = parseInvoice(source);
  assert.equal(errors.length, 0);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.line, 3);
});

test("supports decimal quantities", () => {
  const { items, errors } = parseInvoice("2.5 x Bulk item @ 4.00");
  assert.equal(errors.length, 0);
  assert.equal(items[0]?.quantity, 2.5);
  assert.equal(items[0]?.amount, 10);
});

test("rounds the computed amount to two decimal places", () => {
  const { items, errors } = parseInvoice("3 x Item @ 0.1");
  assert.equal(errors.length, 0);
  // 3 * 0.1 is 0.30000000000000004 in floating point.
  assert.equal(items[0]?.amount, 0.3);
});

test("rejects a line missing the x separator", () => {
  const { items, errors } = parseInvoice("5 Widget @ 1.00");
  assert.equal(items.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /expected "x" after the quantity, found "Widget"/);
  assert.equal(errors[0]!.column, 3);
});

test("reports end of line when the separator is missing entirely", () => {
  const { errors } = parseInvoice("5");
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /found end of line/);
});

test("rejects an invalid quantity token", () => {
  const { errors } = parseInvoice("abc x Widget @ 1.00");
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /"abc" is not a valid quantity/);
  assert.equal(errors[0]!.column, 1);
});

test("rejects a zero quantity", () => {
  const { errors } = parseInvoice("0 x Widget @ 1.00");
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /quantity must be greater than zero/);
});

test("rejects a negative quantity", () => {
  const { errors } = parseInvoice("-1 x Widget @ 1.00");
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /quantity must be greater than zero/);
});

test("rejects a line with no description between the separators", () => {
  const { errors } = parseInvoice("1 x  @ 5.00");
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /line item is missing a description/);
});

test("reports a missing @ when none is present", () => {
  const line = "1 x Widget 5.00";
  const { errors } = parseInvoice(line);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /expected "@" followed by a unit price/);
  assert.equal(errors[0]!.column, line.length + 1);
});

test("rejects an invalid unit price token", () => {
  const { errors } = parseInvoice("1 x Widget @ abc");
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /"abc" is not a valid unit price/);
  assert.equal(errors[0]!.column, 14);
});

test("rejects a negative unit price", () => {
  const { errors } = parseInvoice("1 x Widget @ -5");
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /unit price cannot be negative/);
  assert.equal(errors[0]!.column, 14);
});

test("reports nothing when the unit price is missing after @", () => {
  const { errors } = parseInvoice("1 x Widget @ ");
  assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /nothing is not a valid unit price/);
});

test("an @ embedded in a description without surrounding spaces is not mistaken for the separator", () => {
  const { items, errors } = parseInvoice("1 x Contact me@example.com @ 5.00");
  assert.equal(errors.length, 0);
  assert.equal(items[0]?.description, "Contact me@example.com");
});

test("collects errors from multiple lines with correct line numbers", () => {
  const source = ["1 x Widget @ 1.00", "0 x Bad quantity @ 1.00", "1 x Widget @ -1"].join("\n");
  const { items, errors } = parseInvoice(source);
  assert.equal(items.length, 1);
  assert.equal(errors.length, 2);
  assert.equal(errors[0]!.line, 2);
  assert.equal(errors[1]!.line, 3);
});

test("handles CRLF line endings", () => {
  const source = "1 x Widget @ 1.00\r\n2 x Gadget @ 2.00\r\n";
  const { items, errors } = parseInvoice(source);
  assert.equal(errors.length, 0);
  assert.equal(items.length, 2);
  assert.equal(items[1]?.line, 2);
});

test("SourceError.format renders a caret under the offending column", () => {
  const line = "3 x Shipping box (small) 4.50";
  const { errors } = parseInvoice(line);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.column, line.length + 1);
  const formatted = errors[0]!.format();
  assert.equal(
    formatted,
    [
      'error: expected "@" followed by a unit price',
      ` --> line 1, column ${line.length + 1}`,
      " |",
      `1 | ${line}`,
      ` | ${" ".repeat(line.length)}^`,
    ].join("\n"),
  );
});

test("parseInvoiceOrThrow throws InvoiceParseError carrying every error", () => {
  const source = ["0 x Bad quantity @ 1.00", "1 x Widget @ -1"].join("\n");
  assert.throws(
    () => parseInvoiceOrThrow(source),
    (err: unknown) => err instanceof InvoiceParseError && err.errors.length === 2,
  );
});

test("parseInvoiceOrThrow returns the parsed items when there are no errors", () => {
  const items = parseInvoiceOrThrow("2 x Widget @ 19.99");
  assert.equal(items.length, 1);
});
