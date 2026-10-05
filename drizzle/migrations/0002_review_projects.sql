CREATE TABLE public.review_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  review_date date NOT NULL DEFAULT current_date,
  deadline date,
  creating text NOT NULL,
  objective text NOT NULL,
  audience text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_projects_brand_idx ON public.review_projects(brand_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_projects TO authenticated;
GRANT ALL ON public.review_projects TO service_role;
ALTER TABLE public.review_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace review projects" ON public.review_projects
  FOR ALL TO authenticated
  USING (public.can_access_brand(brand_id))
  WITH CHECK (public.can_access_brand(brand_id));

ALTER TABLE public.validation_checks
  ADD COLUMN project_id uuid REFERENCES public.review_projects(id) ON DELETE CASCADE;
CREATE INDEX validation_checks_project_idx ON public.validation_checks(project_id);