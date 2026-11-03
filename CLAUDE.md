# Dental Lab for Claude Code

A production record desk for a dental laboratory. The operator supplies the business, intended change and evidence. Read this file before acting.

Read records before answering. Run npm run lab -- help for flags. Values use --name=value and every command supports --json. Exact codes, partial ids and case-insensitive names work. Ambiguous matches list candidates and exit 1. Obtain the exact record before continuing.

Never prescribe, design a device, classify it, decide clinical suitability, fabricate a quality pass or treat a reference as proof of the document's contents. Record actual decisions from qualified staff. Read docs/compliance.md before explaining a finding. Nothing here sends, books a courier, processes payments or submits regulatory forms.

Drafts go to drafts/. Keep real data, imports, exports and generated reports out of git. Seed only synthetic demo data. An actor is an attribution label, not authentication. Restrict OS and database access.

## One route per recurring job

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

## Files

scripts/lab.mjs is the single domain CLI. supabase/migrations holds numbered PostgreSQL migrations that also run on PGlite. npm run migrate applies new migrations. DATABASE_URL selects hosted PostgreSQL; DATA_DIR selects the embedded database location. brand.json sets report branding, views.json and documents.json define read-only outputs.

Read docs/replace-labtrac.md before an import. Never edit an applied migration on a working installation. Export a private snapshot, change through a new migration, run npm test, and inspect the reports.

Built and run for owners through Omni by Enterprise DNA. https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=labtrac
