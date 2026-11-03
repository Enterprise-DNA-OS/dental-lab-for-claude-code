# record-qc

Record the actual quality review and supporting evidence.

Run `npm run lab -- record-qc`. Accepted flags: `--order --result --date --manufactured --evidence --actor`. Add `--json` for structured results. All value flags use `--name=value`.

Read the relevant records first. Supply only values supported by the operator's instructions and evidence. If an id or name is ambiguous, present the candidates and obtain the exact record. Every mutation requires `--actor`. An actor label is not authentication.

Use the actual quality reviewer's evidence. A record of a pass is not a clinical judgment by this agent. Never invent checks or backdate them.

Present the answer in plain language, with dates and record codes. State missing evidence. Never guess, send, delete, process a payment or connect a scanner.
