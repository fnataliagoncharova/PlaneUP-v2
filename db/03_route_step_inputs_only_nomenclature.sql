ALTER TABLE route_step_inputs
DROP CONSTRAINT IF EXISTS route_step_inputs_input_source_check;

DELETE FROM route_step_inputs
WHERE input_nomenclature_id IS NULL;

ALTER TABLE route_step_inputs
ALTER COLUMN input_nomenclature_id SET NOT NULL;

ALTER TABLE route_step_inputs
DROP COLUMN IF EXISTS external_input_name;
