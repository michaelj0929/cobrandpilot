
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  brand_type TEXT,
  primary_market TEXT,
  description TEXT,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.source_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  storage_path TEXT,
  kind TEXT NOT NULL DEFAULT 'file',
  pasted_text TEXT,
  classification TEXT,
  suggested_classification TEXT,
  classification_rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  rules_extracted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  source_file_id UUID REFERENCES public.source_files(id) ON DELETE SET NULL,
  layer TEXT NOT NULL DEFAULT 'execution',
  rule_type TEXT NOT NULL,
  label TEXT NOT NULL,
  statement TEXT,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'should',
  scope TEXT NOT NULL DEFAULT 'global',
  time_scope TEXT NOT NULL DEFAULT 'permanent',
  authority TEXT,
  review_state TEXT NOT NULL DEFAULT 'inferred',
  status TEXT NOT NULL DEFAULT 'proposed',
  confidence TEXT,
  source_citation TEXT,
  source_evidence TEXT,
  conflict_note TEXT,
  superseded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rule_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.rules(id) ON DELETE CASCADE,
  example_type TEXT NOT NULL DEFAULT 'do',
  description TEXT NOT NULL,
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.context_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.rules(id) ON DELETE CASCADE,
  channel TEXT,
  format TEXT,
  audience TEXT,
  market TEXT,
  language TEXT,
  funnel_stage TEXT,
  objective TEXT,
  product TEXT,
  campaign TEXT,
  campaign_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.setup_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  layer TEXT,
  gap_type TEXT NOT NULL DEFAULT 'missing',
  source_note TEXT,
  why_it_matters TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  diff_summary TEXT NOT NULL,
  edited_via TEXT NOT NULL DEFAULT 'form',
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.validation_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  brand_model_version INTEGER NOT NULL DEFAULT 1,
  input_type TEXT NOT NULL DEFAULT 'copy',
  brief_text TEXT,
  copy_text TEXT,
  asset_path TEXT,
  asset_mime TEXT,
  asset_name TEXT,
  creative_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  readiness JSONB,
  applied_rules JSONB,
  score INTEGER,
  label TEXT,
  summary TEXT,
  dimension_scores JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES public.validation_checks(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.rules(id) ON DELETE SET NULL,
  number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  pass_name TEXT NOT NULL DEFAULT 'objective',
  dimension TEXT,
  severity TEXT NOT NULL DEFAULT 'should',
  confidence TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'issue',
  explanation TEXT NOT NULL,
  why_it_matters TEXT,
  rule_statement TEXT,
  applies_because TEXT,
  source_citation TEXT,
  suggested_fix TEXT,
  quote TEXT,
  pin_x NUMERIC,
  pin_y NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rules_brand ON public.rules(brand_id);
CREATE INDEX idx_source_files_brand ON public.source_files(brand_id);
CREATE INDEX idx_gaps_brand ON public.setup_gaps(brand_id);
CREATE INDEX idx_checks_brand ON public.validation_checks(brand_id);
CREATE INDEX idx_findings_check ON public.findings(check_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_source_files_updated BEFORE UPDATE ON public.source_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_rules_updated BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gaps_updated BEFORE UPDATE ON public.setup_gaps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_checks_updated BEFORE UPDATE ON public.validation_checks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_files TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_examples TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.context_tags TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setup_gaps TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_versions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.validation_checks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO anon, authenticated;
GRANT ALL ON public.brands, public.source_files, public.rules, public.rule_examples, public.context_tags, public.setup_gaps, public.brand_versions, public.validation_checks, public.findings TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setup_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prototype open access" ON public.brands FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prototype open access" ON public.source_files FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prototype open access" ON public.rules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prototype open access" ON public.rule_examples FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prototype open access" ON public.context_tags FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prototype open access" ON public.setup_gaps FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prototype open access" ON public.brand_versions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prototype open access" ON public.validation_checks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prototype open access" ON public.findings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
