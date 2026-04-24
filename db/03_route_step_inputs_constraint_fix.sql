BEGIN;

-- 1) Normalize existing data: empty/space-only external names become NULL.
UPDATE route_step_inputs
SET external_input_name = NULL
WHERE NULLIF(BTRIM(external_input_name), '') IS NULL;

-- 2) Drop old "input source" check constraint(s), regardless of auto-generated name.
DO $$
DECLARE
    current_constraint_name TEXT;
BEGIN
    FOR current_constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'route_step_inputs'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%input_nomenclature_id IS NOT NULL%'
          AND pg_get_constraintdef(oid) ILIKE '%external_input_name%'
    LOOP
        EXECUTE format(
            'ALTER TABLE route_step_inputs DROP CONSTRAINT %I',
            current_constraint_name
        );
    END LOOP;
END $$;

-- 3) Add new strict source check: nomenclature OR non-empty trimmed external name.
ALTER TABLE route_step_inputs
ADD CONSTRAINT route_step_inputs_input_source_check
CHECK (
    input_nomenclature_id IS NOT NULL
    OR NULLIF(BTRIM(external_input_name), '') IS NOT NULL
);

COMMIT;
