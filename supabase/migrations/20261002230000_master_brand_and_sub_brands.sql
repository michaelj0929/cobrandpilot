-- One master brand per workspace, with sub-brands and product lines under it.
--
-- A sub-brand / product line is a brands row with parent_brand_id set, so it
-- keeps its own sources, rules, gaps and versions. Creative checks belong to
-- the master brand and record which sub-brands' guidelines were included.

ALTER TABLE public.brands
  ADD COLUMN parent_brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'master';

ALTER TABLE public.brands
  ADD CONSTRAINT brands_kind_check CHECK (kind IN ('master', 'sub_brand', 'product_line')),
  ADD CONSTRAINT brands_kind_matches_parent CHECK (
    (kind = 'master' AND parent_brand_id IS NULL)
    OR (kind <> 'master' AND parent_brand_id IS NOT NULL)
  );

CREATE INDEX brands_parent_brand_id_idx ON public.brands(parent_brand_id);

-- One master brand per workspace. There are no accounts yet; when they are
-- added, make this unique per owner/workspace instead.
CREATE UNIQUE INDEX brands_one_master_per_workspace
  ON public.brands ((true))
  WHERE parent_brand_id IS NULL;

-- Sub-brands hang directly off the master: no sub-brands of sub-brands.
CREATE OR REPLACE FUNCTION public.brands_parent_is_master()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_brand_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.brands WHERE id = NEW.parent_brand_id AND parent_brand_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A sub-brand must sit directly under the master brand.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER brands_parent_is_master
  BEFORE INSERT OR UPDATE OF parent_brand_id ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.brands_parent_is_master();

-- Which sub-brand / product-line guideline sets a check was run against
-- (on top of the master brand, which is always included).
ALTER TABLE public.validation_checks
  ADD COLUMN sub_brand_ids UUID[] NOT NULL DEFAULT '{}';
