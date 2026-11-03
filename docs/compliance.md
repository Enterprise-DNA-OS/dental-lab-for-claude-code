# Record checks and their limits

Checked 2026-11-03. This is a lab operations record tool. It does not determine medical-device classification, clinical suitability, conformity or authorisation to supply. References point to evidence held elsewhere; the software does not verify its contents. Qualified people make and sign the underlying decisions.

## Australian custom-made device records

Source: [TGA guidance](https://www.tga.gov.au/resources/guidance/understanding-regulation-custom-made-medical-devices).

Most devices made for a particular patient are not automatically custom-made under the TGA definition. AU cases begin unreviewed. review-case records the qualified reviewer's pathway and evidence. custom-made rules apply only after that explicit classification.

The checks flag missing prescription, statement and conformity references or an unknown implantability decision. For manufactured custom-made orders, retain_until must reach at least five years after manufacture for non-implantable devices or fifteen years for implantable devices. These checks cover only selected records. Notification, annual reporting, adverse events, inspections, full statement contents and all other obligations remain outside this implementation. Generated delivery notes are not statutory device statements.

Patient-matched and other device pathways require their own applicable policy. This base does not apply custom-made retention rules to them. See [TGA distribution records](https://www.tga.gov.au/products/medical-devices/supply-and-distribution/distribution-records) for distinct sponsor duties. Have the responsible person set the applicable retention policy before operating.

## New Zealand health information

Sources: [current Health Information Privacy Code](https://www.privacy.org.nz/privacy-principles/codes-of-practice/hipc2020/) and [security, retention and disposal guidance](https://www.privacy.org.nz/privacy-principles/codes-of-practice/hipc2020/hipc-factsheet-5-storage-security-retention-and-disposal-of-health-information/).

Rule 5 concerns security safeguards; Rule 9 concerns retention for lawful purposes alongside applicable minimum periods. The purpose-review reminder is a local control, not a legally prescribed review interval. It never deletes information. Configure access, encryption, backups, incident procedures and lawful retention with the lab. This program does not prove those controls are operating.

## Local operating policy

Material use after expiry or before receipt is rejected. Tasks must be completed before a quality pass. A prescription reference and material use are required. Ready work is frozen against further bench changes. Quality evidence is append-only. Dispatch requires the recorded pass and no applicable case/order findings. These are conservative workflow controls, not a complete regulatory checklist or an automated clinical release decision.

Unknown jurisdiction stays a review finding and blocks dispatch until review-case records it. Do not use the absence of findings as a declaration of legal compliance. RLS and removed PUBLIC privileges reduce accidental exposure but a trusted database owner can bypass them. Review the deployment before loading real health information.
