CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Evidence is append-only'; END $$;
CREATE TABLE practices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(length(trim(code))>0), name text NOT NULL CHECK(length(trim(name))>0),
 owner text NOT NULL, review_on date NOT NULL, purpose text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, practice_id uuid NOT NULL REFERENCES practices,
 patient_ref text NOT NULL, prescription_ref text, jurisdiction text NOT NULL DEFAULT 'unknown' CHECK(jurisdiction IN ('AU','NZ','other','unknown')),
 device_kind text NOT NULL DEFAULT 'unreviewed' CHECK(device_kind IN ('unreviewed','custom-made','patient-matched','other')),
 classification_evidence text, implantable boolean, statement_ref text, conformity_ref text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, case_id uuid NOT NULL REFERENCES cases,
 product text NOT NULL, units integer NOT NULL CHECK(units>0), technician text NOT NULL,
 received_on date NOT NULL, due_on date NOT NULL, stage text NOT NULL DEFAULT 'received' CHECK(stage IN ('received','production','approval','qc','ready','dispatched','cancelled')),
 stage_since date NOT NULL DEFAULT CURRENT_DATE, remake_of uuid REFERENCES orders, remake_reason text,
 manufactured_on date, retain_until date, dispatched_on date, delivery_ref text,
 source_row jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(due_on>=received_on), CHECK(manufactured_on IS NULL OR manufactured_on>=received_on),
 CHECK(dispatched_on IS NULL OR (manufactured_on IS NOT NULL AND dispatched_on>=manufactured_on)),
 CHECK((remake_of IS NULL AND remake_reason IS NULL) OR (remake_of IS NOT NULL AND length(trim(remake_reason))>0)),
 CHECK(stage<>'dispatched' OR (dispatched_on IS NOT NULL AND length(trim(delivery_ref))>0)),
 CHECK(stage NOT IN ('ready','dispatched') OR manufactured_on IS NOT NULL)
);
CREATE TABLE tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders, label text NOT NULL, technician text NOT NULL,
 due_on date NOT NULL, done_on date, evidence text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(done_on IS NULL OR length(trim(evidence))>0)
);
CREATE TABLE lots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, material text NOT NULL, supplier text NOT NULL,
 expires_on date NOT NULL, evidence text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lot_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders, lot_id uuid NOT NULL REFERENCES lots,
 quantity numeric(14,4) NOT NULL CHECK(quantity>0), unit text NOT NULL, used_on date NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,lot_id)
);
CREATE TABLE qc_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders, passed boolean NOT NULL,
 evidence text NOT NULL CHECK(length(trim(evidence))>0), actor text NOT NULL, reviewed_on date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), digest text NOT NULL UNIQUE, original_csv text NOT NULL, mapping jsonb NOT NULL,
 actor text NOT NULL, row_count integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, record_id uuid, actor text NOT NULL, detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['practices','cases','orders','tasks','lots','lot_usage','qc_reviews','imports','activity'] LOOP
  EXECUTE format('CREATE TRIGGER updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated()',n);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['lot_usage','qc_reviews','imports','activity'] LOOP
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_record()',n);
 END LOOP;
END $$;
CREATE INDEX order_case ON orders(case_id);
CREATE INDEX task_order ON tasks(order_id);
CREATE INDEX usage_order ON lot_usage(order_id);
CREATE VIEW order_desk AS
 SELECT o.id,o.code,c.code AS case_code,p.name AS practice,o.product,o.units,o.technician,o.stage,o.received_on,o.due_on,
 o.stage_since, CURRENT_DATE-o.due_on AS days_late,
 (SELECT count(*)::int FROM tasks t WHERE t.order_id=o.id AND t.done_on IS NULL) AS open_tasks,
 (SELECT count(*)::int FROM lot_usage u WHERE u.order_id=o.id) AS recorded_lots,
 o.remake_of,o.remake_reason,o.manufactured_on,o.retain_until,o.dispatched_on,o.delivery_ref
 FROM orders o JOIN cases c ON c.id=o.case_id JOIN practices p ON p.id=c.practice_id;
CREATE VIEW due_board AS SELECT code,practice,product,technician,stage,due_on,days_late,open_tasks,recorded_lots
 FROM order_desk WHERE stage NOT IN ('cancelled','dispatched') AND due_on<=CURRENT_DATE+7;
CREATE VIEW bench_load AS SELECT t.technician,count(*)::int AS open_tasks,
 count(*) FILTER(WHERE t.due_on<CURRENT_DATE)::int AS overdue_tasks,min(t.due_on) AS first_due
 FROM tasks t JOIN orders o ON o.id=t.order_id WHERE t.done_on IS NULL AND o.stage NOT IN ('cancelled','dispatched') GROUP BY t.technician;
CREATE VIEW traceability AS SELECT o.code AS order_code,c.code AS case_code,p.name AS practice,l.code AS lot_code,l.material,l.supplier,
 u.quantity,u.unit,u.used_on,l.expires_on,(u.used_on>l.expires_on) AS expired_at_use,o.stage,o.dispatched_on,o.delivery_ref
 FROM lot_usage u JOIN lots l ON l.id=u.lot_id JOIN orders o ON o.id=u.order_id JOIN cases c ON c.id=o.case_id JOIN practices p ON p.id=c.practice_id;
CREATE VIEW compliance_findings AS
 SELECT 'classification review'::text AS rule,c.id AS record_id,c.code AS record,'Device pathway not reviewed'::text AS finding,'https://www.tga.gov.au/resources/guidance/understanding-regulation-custom-made-medical-devices'::text AS source
 FROM cases c WHERE c.jurisdiction='AU' AND (c.device_kind='unreviewed' OR c.classification_evidence IS NULL)
 UNION ALL SELECT 'prescription reference',id,code,'Prescription evidence missing','https://www.tga.gov.au/resources/guidance/understanding-regulation-custom-made-medical-devices' FROM cases WHERE jurisdiction='AU' AND device_kind='custom-made' AND prescription_ref IS NULL
 UNION ALL SELECT 'custom-made evidence',id,code,'Statement, conformity evidence or implantability review missing','https://www.tga.gov.au/resources/guidance/understanding-regulation-custom-made-medical-devices' FROM cases WHERE jurisdiction='AU' AND device_kind='custom-made' AND (statement_ref IS NULL OR conformity_ref IS NULL OR implantable IS NULL)
 UNION ALL SELECT 'custom-made retention',o.id,o.code,'Review retention against manufacture date and implantability','https://www.tga.gov.au/resources/guidance/understanding-regulation-custom-made-medical-devices'
 FROM orders o JOIN cases c ON c.id=o.case_id WHERE c.jurisdiction='AU' AND c.device_kind='custom-made' AND o.manufactured_on IS NOT NULL AND (o.retain_until IS NULL OR c.implantable IS NULL OR o.retain_until<(o.manufactured_on+CASE WHEN c.implantable THEN interval '15 years' ELSE interval '5 years' END)::date)
 UNION ALL SELECT 'privacy purpose review',id,code,'Contact purpose review overdue','https://www.privacy.org.nz/privacy-principles/codes-of-practice/hipc2020/hipc-factsheet-5-storage-security-retention-and-disposal-of-health-information/' FROM practices WHERE review_on<CURRENT_DATE
 UNION ALL SELECT 'jurisdiction review',id,code,'Confirm jurisdiction and applicable retention policy','local:operating-policy' FROM cases WHERE jurisdiction='unknown'
 UNION ALL SELECT 'material expiry',u.id,o.code,'Recorded material was expired on date of use','local:operating-policy' FROM lot_usage u JOIN lots l ON l.id=u.lot_id JOIN orders o ON o.id=u.order_id WHERE u.used_on>l.expires_on;
REVOKE ALL ON order_desk,due_board,bench_load,traceability,compliance_findings FROM PUBLIC;

CREATE UNIQUE INDEX practices_code_folded ON practices(lower(code));
CREATE UNIQUE INDEX cases_code_folded ON cases(lower(code));
CREATE UNIQUE INDEX orders_code_folded ON orders(lower(code));
CREATE UNIQUE INDEX lots_code_folded ON lots(lower(code));
