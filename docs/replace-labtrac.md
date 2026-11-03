# Move a production record from Labtrac

## What is verified

Labtrac's [object graph](https://api.labtrac.com/) describes laboratories, dentists, cases, patients, orders and order items. Its [manual](https://github.com/labtrac/legacy-docs/blob/master/Labtrac.Manual.md) describes multi-stage work and dentist returns. Its [FAQ](https://docs.labtrac.com/team-docs/documentation/faqs) discusses invoice exports and PDF documents. These pages were re-opened on 2026-11-03. None establishes a stable whole-account CSV layout. The older manual is context, not a promise about every current installation.

Ask the authorised account administrator or Labtrac support for an extract of the required records. Confirm access and cost with the vendor. Do not infer that PDF invoice exports contain production history. Retain original documents, scans and audit records separately.

## The intake contract

One row represents one order, not one order item. Consolidate multi-item work only after an operator approves how its product description and units should read. Required fields are practice_code, practice_name, case_code, patient_ref, order_code, product, units, technician, received_on and due_on. Optional prescription_ref and jurisdiction map evidence references and AU, NZ, other or unknown. Dates must be real YYYY-MM-DD values. Units must be positive integers.

The same case code must have the same practice, patient reference, prescription reference and jurisdiction throughout the file. Names are not identity keys. Use stable source identifiers. Avoid copying patient names when a private reference is sufficient. The original file and every extra column are retained in the private database.

When headings differ, create a JSON mapping from intake fields to exact source headings, for example {"order_code":"Job Number","practice_code":"Dentist Code"}. These are mapping examples, not claimed vendor headers. A synthetic example is in fixtures/labtrac-mapped.csv. Real files belong in imports/.

## One-command import

First test and reconcile the prepared file:

```sh
npm run lab -- import labtrac --file=imports/orders.csv --mapping=imports/mapping.json --actor="Lab manager" --dry-run --json
```

Then load it:

```sh
npm run lab -- import labtrac --file=imports/orders.csv --mapping=imports/mapping.json --actor="Lab manager"
```

Without a mapping, the intake headings above are used directly. The entire batch commits or rolls back. A repeat of the identical file and mapping is a no-op. A changed extract containing an existing order is rejected, preserving live work. Resolve a correction through a reviewed migration rather than overwriting history.

## Reconcile before relying on it

Compare order counts, case-to-practice links, products, quantities and dates with the source. Imported work always enters received. Its original status remains in source_row but does not become an approval, quality pass or dispatch. Map production status with evidence before using live due reports. Lot use, bench tasks, remakes, quality reviews and dispatch evidence require separate reconciliation and entry. Historical completed work must not be treated as fresh production. Use a reviewed migration for historical lifecycle records and reconcile it before switching.

This import does not move CAD files, scans, attachments, invoice balances, payments, pricing lists, user permissions, manufacturer registrations or signed statements. Keep those with the relevant systems until a separately scoped migration is verified. A source extract ready to map can be loaded in one session; a full switch depends on vendor access and evidence reconciliation. Enterprise DNA performs that mapping and checking when building your version.

Run both records side by side until the lab manager accepts the reconciliation. Keep a backup before changing anything. Stop paying for an incumbent only after the business has accepted its replacement.
