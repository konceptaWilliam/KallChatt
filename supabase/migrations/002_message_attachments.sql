-- Add attachments support to messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';

-- Storage bucket: create a public "attachments" bucket in the Supabase dashboard,
-- then apply these policies in the SQL editor:

-- CREATE POLICY "attachment upload" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
--
-- CREATE POLICY "attachment read" ON storage.objects
--   FOR SELECT TO public
--   USING (bucket_id = 'attachments');
