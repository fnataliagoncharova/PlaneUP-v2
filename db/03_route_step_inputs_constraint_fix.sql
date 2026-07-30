BEGIN;

DO $$
DECLARE
    has_external_input_name BOOLEAN;
    current_constraint_name TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'route_step_inputs'
          AND column_name = 'external_input_name'
    )
    INTO has_external_input_name;

    IF has_external_input_name THEN
        EXECUTE $sql$
            UPDATE route_step_inputs
            SET external_input_name = NULL
            WHERE NULLIF(BTRIM(external_input_name), '') IS NULL
        $sql$;

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

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'route_step_inputs'::regclass
              AND conname = 'route_step_inputs_input_source_check'
        ) THEN
            EXECUTE $sql$
                ALTER TABLE route_step_inputs
                ADD CONSTRAINT route_step_inputs_input_source_check
                CHECK (
                    input_nomenclature_id IS NOT NULL
                    OR NULLIF(BTRIM(external_input_name), '') IS NOT NULL
                )
            $sql$;
        END IF;
    END IF;
END $$;

COMMIT;
