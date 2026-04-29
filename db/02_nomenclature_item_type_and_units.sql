ALTER TABLE nomenclature
ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'manufactured';

ALTER TABLE nomenclature
DROP CONSTRAINT IF EXISTS nomenclature_unit_of_measure_check;

ALTER TABLE nomenclature
ADD CONSTRAINT nomenclature_unit_of_measure_check
CHECK (unit_of_measure IN ('м²', 'м.п.', 'шт', 'кг', 'л'));

ALTER TABLE nomenclature
DROP CONSTRAINT IF EXISTS nomenclature_item_type_check;

ALTER TABLE nomenclature
ADD CONSTRAINT nomenclature_item_type_check
CHECK (item_type IN ('manufactured', 'purchased'));
