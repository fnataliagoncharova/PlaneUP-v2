ALTER TABLE route_steps
ADD COLUMN IF NOT EXISTS post_process_wait_hours NUMERIC(8,2) NULL;

ALTER TABLE route_steps
DROP CONSTRAINT IF EXISTS route_steps_post_process_wait_hours_check;

ALTER TABLE route_steps
ADD CONSTRAINT route_steps_post_process_wait_hours_check
CHECK (post_process_wait_hours IS NULL OR post_process_wait_hours >= 0);
