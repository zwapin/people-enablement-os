-- Knowledge documents table
CREATE TABLE public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  context text,
  content text NOT NULL DEFAULT '',
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on knowledge_documents"
  ON public.knowledge_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Knowledge FAQs table
CREATE TABLE public.knowledge_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on knowledge_faqs"
  ON public.knowledge_faqs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reps can view knowledge_faqs"
  ON public.knowledge_faqs FOR SELECT TO authenticated
  USING (true);

-- Storage bucket for uploaded files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-files',
  'knowledge-files',
  false,
  10485760,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
);

-- Storage RLS: admin-only upload/read/delete
CREATE POLICY "Admins can upload knowledge files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read knowledge files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete knowledge files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-files' AND has_role(auth.uid(), 'admin'::app_role));