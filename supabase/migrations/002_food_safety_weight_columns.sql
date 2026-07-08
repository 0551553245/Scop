-- Added standard_type and unit columns to food_safety_standards
-- See BUG #155 in .claude/skills/scoop-bug-log/SKILL.md
ALTER TABLE public.food_safety_standards
ADD COLUMN IF NOT EXISTS standard_type TEXT DEFAULT 'temperature',
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '°C';

-- Backfill existing rows using the same inference the app already used
-- before this column existed (min_temp/max_temp non-null => temperature,
-- otherwise => compliance). New column DEFAULTs alone would leave
-- compliance-type standards mislabeled as 'temperature'/'°C'.
UPDATE public.food_safety_standards
SET standard_type = 'temperature', unit = '°C'
WHERE min_temp IS NOT NULL OR max_temp IS NOT NULL;

UPDATE public.food_safety_standards
SET standard_type = 'compliance', unit = NULL
WHERE min_temp IS NULL AND max_temp IS NULL;
