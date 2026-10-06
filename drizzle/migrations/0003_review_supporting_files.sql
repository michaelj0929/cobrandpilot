ALTER TABLE public.validation_checks
  ADD COLUMN IF NOT EXISTS brief_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS copy_files jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.validation_checks.brief_files IS 'Creative brief file metadata stored as JSON objects with path, name, and MIME type.';
COMMENT ON COLUMN public.validation_checks.copy_files IS 'Copy file metadata stored as JSON objects with path, name, and MIME type.';