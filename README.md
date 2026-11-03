# Dental Lab for Claude Code

Run your dental laboratory's case handoffs, bench tasks, material lots, remakes and dispatch records from a database you own.

## Three ways to own it

- **Do it yourself:** use the MIT-licensed base with Claude Code, Codex, OpenCode or Cursor. Hosting and your agent subscription are separate costs.
- **We customise it:** Enterprise DNA maps your Labtrac records, fits your fields and production stages, connects your systems and builds a web front end or a different stack when needed. One setup fee, then a retainer.
- **We run it for you:** Omni by Enterprise DNA installs your version, manages access and backups and keeps it working. One setup fee, then a retainer.

[Book a 30-minute call with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=labtrac).

## Run the synthetic demo

Node 20 or newer. No cloud account is required.

```sh
npm install
npm test
npm run demo
npm run lab -- due-board
npm run lab -- approval-chase
npm run lab -- lot-trace --lot=RES-DEMO-2 --json
npm run view
npm run docs
```

The demo contains invented practice and patient references, an overdue crown order, an old dentist approval, a remake and an insufficient retention date. Seed only a demo database. Existing rows remain unchanged on repeat seeding. Use a fresh DATA_DIR for real records. DATABASE_URL selects PostgreSQL; otherwise PGlite stores records under .data/db. Dates use UTC day boundaries.

## What the base does

Cases group orders for the same treatment record. Each order has its own product, quantity, technician, received date and due date. Remakes keep a reference to the original order in the same case. Tasks carry due dates and completion evidence. A material lot can be traced through its recorded use to a practice and dispatch reference.

Production moves through received, production, approval, quality review, ready and dispatched. Returning from dentist approval means an explicit move to production. A failed quality review returns work to production. Cancellation keeps history. A quality pass requires completed tasks, a prescription reference and recorded material lots. Dispatch requires a recorded pass and the applicable evidence checks. No software check evaluates a device's clinical suitability.

Material use, quality reviews, import batches and activity are append-only. Imports preserve the original file and extra columns. Identical file-and-mapping imports are no-ops. Existing order codes are never overwritten by a changed extract. Imported orders enter received for reconciliation, even when a source column says completed.

Labtrac also provides scanner intake, manufacturing connections, billing and customer screens. This base is a production record desk. It contains no CAD/CAM, STL viewer, clinical decision engine, scanner integration, live courier booking, accounting or payments. Enterprise DNA scopes those connections and screens separately. Physical quality review, legal classification and external regulatory submissions remain with qualified people.

## Recurring jobs

| Command | Purpose |
|---|---|
| /help | Read accepted commands and flags. |
| /practices | Read lab customers and purpose review dates. |
| /cases | Read cases, patient references and prescription references. |
| /orders | Read the production ledger. |
| /due-board | Find overdue work and deliveries due within seven days. |
| /bench-load | Count open and overdue tasks by technician. |
| /approval-chase | Find work still with a dentist and days waiting. |
| /lots | Read material lots and expiry dates. |
| /lot-trace | Find every recorded order and destination for one material lot. |
| /remakes | Read remakes beside the original order and reason. |
| /compliance | Review missing record evidence and retention dates. |
| /activity | Read the append-only change record. |
| /order | Read an order with tasks, materials, quality evidence and history. |
| /add-practice | Register a practice with an owner and purpose review date. |
| /add-case | Register a case using a patient reference and authorised prescription. |
| /add-order | Log a work order or a remake within the same case. |
| /add-task | Add a dated bench task to an open order. |
| /finish-task | Record completed work with its evidence. |
| /move-order | Record production, dentist approval, return, quality or cancellation handoffs. |
| /add-lot | Register a material lot and its evidence. |
| /use-lot | Record material used in production, checking the expiry and receipt dates. |
| /record-qc | Record the actual quality review and supporting evidence. |
| /dispatch | Record a completed dispatch after the quality and record checks. |
| /review-case | Record a qualified reviewer's device pathway and evidence references. |
| /retention | Record the retention date agreed for one order. |
| /review-practice | Record the purpose review for practice contact information. |
| /import | Validate and import mapped Labtrac records. |
| /export | Write a new complete private JSON snapshot. |
| /weekly-review | Draft the weekly lab review from three current reports. |
| /draft-chase | Draft a dentist approval follow-up without sending it. |
| /customise | Change fields or rules with a tested migration. |
| /new-view | Add a branded read-only report from current records. |

There are 30 CLI commands and 32 slash commands. Every CLI command supports --json. Values use --name=value. Exact codes take precedence, followed by case-insensitive names or id prefixes. Ambiguous matches list candidates and exit 1. `npm run lab -- help` lists all flags.

## Ten questions your records answer

1. Which orders are overdue despite still having unfinished bench tasks? (`due-board`)
2. Who has the most overdue work on their bench? (`bench-load`)
3. Which dentist approvals have been waiting longest? (`approval-chase`)
4. Which practices received work using a particular material lot? (`lot-trace --lot=RES-DEMO-2`)
5. Which remakes refer back to an earlier order, and why? (`remakes`)
6. Which finished custom-made records have an insufficient retention date? (`compliance`)
7. Which upcoming deliveries have no recorded material lot? (`due-board`)
8. What evidence supported the quality review of this order? (`order --order=LAB-103`)
9. Which practice contact records need a purpose review? (`compliance`)
10. Who recorded each handoff, and what evidence did they provide? (`activity`)

These are executable analyses, not an unsupported claim that Labtrac cannot answer them. Owning the data lets you extend the questions around your lab's decisions.

## Your first hour: ten things to ask for

1. Put our name, logo and colours in brand.json.
2. Show overdue work with unfinished tasks.
3. Show which dentist approvals are oldest.
4. Trace one material lot to every recorded destination.
5. Draft our weekly review from current records.
6. Draft one approval follow-up without sending it.
7. Test a mapped extract and reconcile every order.
8. Show remakes and the original work they refer to.
9. Add our bench location with a tested migration.
10. Export a private snapshot before changing rules.

## Switch from Labtrac

Read [the replace guide](docs/replace-labtrac.md). Labtrac documents a case and order model and invoice/PDF exports. We did not verify a standard whole-account CSV export. Obtain an authorised extract from your installation or Labtrac support, map its headings, then import the prepared file in one command. A same-day switch depends on having that extract and checking it. The fixture is synthetic and is not evidence of a vendor export layout.

## Documents, views and compliance

npm run docs writes work tickets, material trace records, delivery-note working copies and remake reports. npm run view writes a weekly board, material trace report and evidence review. Change brand.json once to brand every output. Generated files remain private and nothing sends or publishes.

[Compliance](docs/compliance.md) defines the limited record checks, cited rules and unresolved reviews. The tool does not certify a lab, classify a medical device or generate a signed statutory device statement. Patient-specific does not automatically mean custom-made under Australian rules.

## Operation and validation

Use a trusted operator account. An actor label records attribution but is not authentication. All domain tables have row-level security enabled and PUBLIC privileges removed. A database owner can bypass these controls. Multi-user access needs a separate access-control design. Keep patient reference mappings and original documents in your controlled clinical document store. Do not commit patient information, real extracts or reports.

`export --file=exports/snapshot.json` writes a complete new JSON snapshot, including raw imports and activity. Protect it like the database. Use native backups too. Snapshot restore is a reviewed maintenance task, not an automated command. Never overwrite a backup.

npm test uses a temporary database and checks every CLI command, state transitions, dates, material traceability, remake linkage, retention checks, import rollback, duplicate handling, exports and escaped branded HTML. The workflow runs Node 20 and 22 on Windows and Ubuntu plus PostgreSQL. TEST_DATABASE_URL must name an empty disposable database. Actual execution results are reported separately from the configured test matrix.

## Licence

MIT. Copyright 2026 Enterprise DNA. Labtrac belongs to its owner. This independent implementation contains no vendor code or assets.
