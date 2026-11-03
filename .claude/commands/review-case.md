# review-case

Record a qualified reviewer's device pathway and evidence references.

Run `npm run lab -- review-case`. Accepted flags: `--case --jurisdiction --kind --classification-evidence --implantable --prescription --statement --conformity --actor`. Add `--json` for structured results. All value flags use `--name=value`.

Read the relevant records first. Supply only values supported by the operator's instructions and evidence. If an id or name is ambiguous, present the candidates and obtain the exact record. Every mutation requires `--actor`. An actor label is not authentication.

Use the qualified reviewer's classification evidence. Never infer custom-made status from a patient-specific design. Read docs/compliance.md.

Present the answer in plain language, with dates and record codes. State missing evidence. Never guess, send, delete, process a payment or connect a scanner.
