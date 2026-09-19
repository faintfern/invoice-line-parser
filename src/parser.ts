// Grammar, one line item per line:
//
//   <quantity> x <description> @ <unit price>
//
// Blank lines and lines starting with # are ignored. The separators "x" and
// "@" must be their own whitespace-delimited tokens, so "Xbox" in a
// description never gets mistaken for the quantity separator.

export interface SourceLocation {
  readonly line: number;
  readonly column: number;
}

/**
 * A single parse failure, anchored to the exact line and column that caused
 * it. `format()` renders it the way a compiler would, with the offending
 * line quoted and a caret under the bad token.
 */
export class SourceError extends Error {
  readonly line: number;
  readonly column: number;
  readonly lineText: string;

  constructor(message: string, location: SourceLocation, lineText: string) {
    super(message);
    this.name = "SourceError";
    this.line = location.line;
    this.column = location.column;
    this.lineText = lineText;
  }

  format(): string {
    const gutter = String(this.line).length;
    const pad = " ".repeat(gutter);
    const pointer = " ".repeat(this.column - 1) + "^";
    return [
      `error: ${this.message}`,
      `${pad} --> line ${this.line}, column ${this.column}`,
      `${pad} |`,
      `${this.line} | ${this.lineText}`,
      `${pad} | ${pointer}`,
    ].join("\n");
  }
}

export class InvoiceParseError extends Error {
  readonly errors: readonly SourceError[];

  constructor(errors: readonly SourceError[]) {
    super(`invoice has ${errors.length} error${errors.length === 1 ? "" : "s"}`);
    this.name = "InvoiceParseError";
    this.errors = errors;
  }

  format(): string {
    return this.errors.map((error) => error.format()).join("\n\n");
  }
}

export interface LineItem {
  readonly line: number;
  readonly quantity: number;
  readonly description: string;
  readonly unitPrice: number;
  readonly amount: number;
}

export interface ParseResult {
  readonly items: readonly LineItem[];
  readonly errors: readonly SourceError[];
}

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

function parseNumber(token: string): number | null {
  if (!NUMBER_PATTERN.test(token)) return null;
  return Number(token);
}

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

/** Reads a run of non-whitespace characters starting at `start`, returning where it ended. */
function readToken(line: string, start: number): { token: string; end: number } {
  let end = start;
  while (end < line.length && !isWhitespace(line[end])) end++;
  return { token: line.slice(start, end), end };
}

function skipWhitespace(line: string, start: number): number {
  let pos = start;
  while (pos < line.length && isWhitespace(line[pos])) pos++;
  return pos;
}

export function parseInvoice(source: string): ParseResult {
  const items: LineItem[] = [];
  const errors: SourceError[] = [];
  const lines = source.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const lineNumber = i + 1;
    const trimmed = rawLine.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const fail = (message: string, column: number): void => {
      errors.push(new SourceError(message, { line: lineNumber, column }, rawLine));
    };

    const qtyStart = skipWhitespace(rawLine, 0);
    const qty = readToken(rawLine, qtyStart);
    if (qty.token.length === 0) {
      fail("expected a quantity at the start of the line", qtyStart + 1);
      continue;
    }

    let pos = skipWhitespace(rawLine, qty.end);
    const separator = readToken(rawLine, pos);
    if (separator.token !== "x") {
      const shown = separator.token.length > 0 ? `"${separator.token}"` : "end of line";
      fail(`expected "x" after the quantity, found ${shown}`, pos + 1);
      continue;
    }

    const descStart = skipWhitespace(rawLine, separator.end);
    const rest = rawLine.slice(descStart);
    const atIndex = rest.lastIndexOf(" @ ");
    if (atIndex === -1) {
      fail('expected "@" followed by a unit price', rawLine.length + 1);
      continue;
    }

    const description = rest.slice(0, atIndex).trimEnd();
    if (description.length === 0) {
      fail("line item is missing a description", descStart + 1);
      continue;
    }

    const afterAt = rest.slice(atIndex + 3);
    const priceLeadingSpace = afterAt.length - afterAt.trimStart().length;
    const priceToken = afterAt.trim();
    const priceColumn = descStart + atIndex + 3 + priceLeadingSpace + 1;

    const quantity = parseNumber(qty.token);
    if (quantity === null) {
      fail(`"${qty.token}" is not a valid quantity`, qtyStart + 1);
      continue;
    }
    if (quantity <= 0) {
      fail("quantity must be greater than zero", qtyStart + 1);
      continue;
    }

    const unitPrice = parseNumber(priceToken);
    if (unitPrice === null) {
      const shown = priceToken.length > 0 ? `"${priceToken}"` : "nothing";
      fail(`${shown} is not a valid unit price`, priceColumn);
      continue;
    }
    if (unitPrice < 0) {
      fail("unit price cannot be negative", priceColumn);
      continue;
    }

    items.push({
      line: lineNumber,
      quantity,
      description,
      unitPrice,
      amount: Math.round(quantity * unitPrice * 100) / 100,
    });
  }

  return { items, errors };
}

export function parseInvoiceOrThrow(source: string): LineItem[] {
  const { items, errors } = parseInvoice(source);
  if (errors.length > 0) throw new InvoiceParseError(errors);
  return items as LineItem[];
}
