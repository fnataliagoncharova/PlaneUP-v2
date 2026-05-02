ALTER TABLE route_step_equipment
ADD COLUMN IF NOT EXISTS min_batch_qty NUMERIC(12,3) NULL;

ALTER TABLE route_step_equipment
DROP CONSTRAINT IF EXISTS route_step_equipment_min_batch_qty_check;

ALTER TABLE route_step_equipment
ADD CONSTRAINT route_step_equipment_min_batch_qty_check
CHECK (min_batch_qty IS NULL OR min_batch_qty > 0);
