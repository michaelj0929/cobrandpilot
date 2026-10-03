CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspaces select" ON public.workspaces FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own workspaces insert" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own workspaces update" ON public.workspaces FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own workspaces delete" ON public.workspaces FOR DELETE TO authenticated USING (owner_id = auth.uid());

ALTER TABLE public.brands ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX brands_workspace_id_idx ON public.brands(workspace_id);

DROP INDEX IF EXISTS public.brands_one_master_per_workspace;
CREATE UNIQUE INDEX brands_one_master_per_workspace ON public.brands (workspace_id) WHERE parent_brand_id IS NULL;

-- Sub-brands inherit their master's workspace.
CREATE OR REPLACE FUNCTION public.brands_inherit_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_brand_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.brands WHERE id = NEW.parent_brand_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER brands_inherit_workspace BEFORE INSERT OR UPDATE OF parent_brand_id ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.brands_inherit_workspace();

CREATE OR REPLACE FUNCTION public.owns_workspace(_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_access_brand(_brand_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brands b JOIN public.workspaces w ON w.id = b.workspace_id
    WHERE b.id = _brand_id AND w.owner_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_check(_check_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.validation_checks c WHERE c.id = _check_id AND public.can_access_brand(c.brand_id))
$$;

DROP POLICY IF EXISTS "prototype open access" ON public.brands;
DROP POLICY IF EXISTS "prototype open access" ON public.source_files;
DROP POLICY IF EXISTS "prototype open access" ON public.rules;
DROP POLICY IF EXISTS "prototype open access" ON public.rule_examples;
DROP POLICY IF EXISTS "prototype open access" ON public.context_tags;
DROP POLICY IF EXISTS "prototype open access" ON public.setup_gaps;
DROP POLICY IF EXISTS "prototype open access" ON public.brand_versions;
DROP POLICY IF EXISTS "prototype open access" ON public.validation_checks;
DROP POLICY IF EXISTS "prototype open access" ON public.findings;

CREATE POLICY "workspace brands" ON public.brands FOR ALL TO authenticated
  USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE POLICY "workspace data" ON public.source_files FOR ALL TO authenticated USING (public.can_access_brand(brand_id)) WITH CHECK (public.can_access_brand(brand_id));
CREATE POLICY "workspace data" ON public.rules FOR ALL TO authenticated USING (public.can_access_brand(brand_id)) WITH CHECK (public.can_access_brand(brand_id));
CREATE POLICY "workspace data" ON public.rule_examples FOR ALL TO authenticated USING (public.can_access_brand(brand_id)) WITH CHECK (public.can_access_brand(brand_id));
CREATE POLICY "workspace data" ON public.context_tags FOR ALL TO authenticated USING (public.can_access_brand(brand_id)) WITH CHECK (public.can_access_brand(brand_id));
CREATE POLICY "workspace data" ON public.setup_gaps FOR ALL TO authenticated USING (public.can_access_brand(brand_id)) WITH CHECK (public.can_access_brand(brand_id));
CREATE POLICY "workspace data" ON public.brand_versions FOR ALL TO authenticated USING (public.can_access_brand(brand_id)) WITH CHECK (public.can_access_brand(brand_id));
CREATE POLICY "workspace data" ON public.validation_checks FOR ALL TO authenticated USING (public.can_access_brand(brand_id)) WITH CHECK (public.can_access_brand(brand_id));
CREATE POLICY "workspace data" ON public.findings FOR ALL TO authenticated USING (public.can_access_check(check_id)) WITH CHECK (public.can_access_check(check_id));

DROP POLICY IF EXISTS "cobrand read files" ON storage.objects;
DROP POLICY IF EXISTS "cobrand upload files" ON storage.objects;
DROP POLICY IF EXISTS "cobrand update files" ON storage.objects;
DROP POLICY IF EXISTS "cobrand delete files" ON storage.objects;
CREATE POLICY "cobrand workspace files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('brand-sources','creatives') AND public.can_access_brand(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id IN ('brand-sources','creatives') AND public.can_access_brand(((storage.foldername(name))[1])::uuid));