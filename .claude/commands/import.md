# import

Validate and import mapped Labtrac records.

Run `npm run lab -- import labtrac`. Accepted flags: `--file --mapping --dry-run --actor`. Add `--json` for structured results. All value flags use `--name=value`.

Read the relevant records first. Supply only values supported by the operator's instructions and evidence. If an id or name is ambiguous, present the candidates and obtain the exact record. Every mutation requires `--actor`. An actor label is not authentication.

Read docs/replace-labtrac.md first. Validate the source extract and mapping. Run with --dry-run first, reconcile row counts, then import on the operator's instruction. A dry run rolls back all writes. Do not infer completed work from a source status.

Present the answer in plain language, with dates and record codes. State missing evidence. Never guess, send, delete, process a payment or connect a scanner.
