
CREATE POLICY "cobrand read files" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id IN ('brand-sources','creatives'));
CREATE POLICY "cobrand upload files" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id IN ('brand-sources','creatives'));
CREATE POLICY "cobrand update files" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id IN ('brand-sources','creatives'));
CREATE POLICY "cobrand delete files" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id IN ('brand-sources','creatives'));
