# move-order

Record production, dentist approval, return, quality or cancellation handoffs.

Run `npm run lab -- move-order`. Accepted flags: `--order --to --evidence --actor`. Add `--json` for structured results. All value flags use `--name=value`.

Read the relevant records first. Supply only values supported by the operator's instructions and evidence. If an id or name is ambiguous, present the candidates and obtain the exact record. Every mutation requires `--actor`. An actor label is not authentication.



Present the answer in plain language, with dates and record codes. State missing evidence. Never guess, send, delete, process a payment or connect a scanner.
