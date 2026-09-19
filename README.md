# invoice-line-parser

A small parser for a plain-text invoice line item format, plus a CLI to run
it against a file. No dependencies, no build tooling beyond `tsc`.

The format shows up whenever someone types invoice line items by hand, or
generates them from a template: quantity, description, unit price. It's easy
to write and easy to get subtly wrong — a missing `@`, a stray decimal, a
quantity of zero. The point of this library is that when a line item is
malformed, the error tells you exactly where, instead of a generic "parse
failed" or a stack trace pointing at the wrong line.

## The format

One line item per line:

```
2 x Widget, Model A @ 19.99
1 x Consulting hour @ 150
3 x Shipping box (small) @ 4.50
```

Blank lines and lines starting with `#` are ignored. `x` and `@` have to be
their own whitespace-separated tokens, so a description like `Xbox controller`
or an email address in a description won't be mistaken for a separator.

## Library usage

```ts
import { parseInvoice, invoiceTotal } from "invoice-line-parser";

const source = `
2 x Widget, Model A @ 19.99
1 x Consulting hour @ 150
`;

const { items, errors } = parseInvoice(source);

if (errors.length > 0) {
  for (const error of errors) console.error(error.format());
} else {
  console.log(items);
  console.log("total:", invoiceTotal(items));
}
```

There's also a throwing variant for callers who'd rather handle one error
object at the top level:

```ts
import { parseInvoiceOrThrow, InvoiceParseError } from "invoice-line-parser";

try {
  const items = parseInvoiceOrThrow(source);
} catch (err) {
  if (err instanceof InvoiceParseError) {
    console.error(err.format());
  }
}
```

## What an error looks like

Given this input, where the third line has no `@`:

```
2 x Widget @ 19.99
1 x Consulting hour @ 150
3 x Shipping box (small) 4.50
```

`parseInvoice` reports:

```
error: expected "@" followed by a unit price
 --> line 3, column 30
 |
3 | 3 x Shipping box (small) 4.50
 |                              ^
```

Every `SourceError` carries `line`, `column`, and the raw `lineText`, so you
can build your own presentation if the built-in `format()` doesn't fit — an
editor gutter marker, a JSON error list for an API response, whatever the
caller needs.

## CLI

```
npx tsc
node dist/cli.js invoice.txt
```

Prints each parsed line item and the running total to stdout, and any parse
errors (formatted as above) to stderr. Exits non-zero if there were errors.

## Status

Early. The parser and CLI work end to end for the format described above.
Not yet covered: multi-currency amounts, quantities with units (`2.5 kg`),
and a proper test suite.

## License

MIT, see [LICENSE](LICENSE).
