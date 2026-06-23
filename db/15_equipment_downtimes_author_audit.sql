ALTER TABLE equipment_downtimes
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);

ALTER TABLE equipment_downtimes
ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER REFERENCES users(id);
