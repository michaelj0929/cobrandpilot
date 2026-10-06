ALTER TABLE public.rules
  ADD COLUMN IF NOT EXISTS rule_code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS scope_tags text[] NOT NULL DEFAULT '{global}',
  ADD COLUMN IF NOT EXISTS source_document text,
  ADD COLUMN IF NOT EXISTS source_page integer,
  ADD COLUMN IF NOT EXISTS confidence_score numeric;

ALTER TABLE public.findings ADD COLUMN IF NOT EXISTS rule_code text;

UPDATE public.rules SET layer = 'intent' WHERE layer = 'foundation';
UPDATE public.rules SET layer = 'recognition' WHERE layer = 'identity';
UPDATE public.setup_gaps SET layer = 'intent' WHERE layer = 'foundation';
UPDATE public.setup_gaps SET layer = 'recognition' WHERE layer = 'identity';
UPDATE public.rules SET category = rule_type WHERE category IS NULL;
UPDATE public.rules SET confidence_score = CASE confidence WHEN 'high' THEN 0.95 WHEN 'medium' THEN 0.75 WHEN 'low' THEN 0.5 ELSE NULL END WHERE confidence_score IS NULL;
UPDATE public.rules SET scope_tags = ARRAY[scope] WHERE scope IS NOT NULL;

WITH numbered AS (
  SELECT id, upper(regexp_replace(split_part(coalesce(category, rule_type), '_', 1), '[^a-zA-Z]', '', 'g')) AS prefix,
         row_number() OVER (PARTITION BY brand_id, upper(regexp_replace(split_part(coalesce(category, rule_type), '_', 1), '[^a-zA-Z]', '', 'g')) ORDER BY created_at, id) AS n
  FROM public.rules WHERE rule_code IS NULL
)
UPDATE public.rules r SET rule_code = numbered.prefix || '-' || lpad(numbered.n::text, 3, '0')
FROM numbered WHERE numbered.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS rules_brand_rule_code ON public.rules (brand_id, rule_code) WHERE rule_code IS NOT NULL;

COMMENT ON COLUMN public.rules.confidence IS 'DEPRECATED: replaced by confidence_score';