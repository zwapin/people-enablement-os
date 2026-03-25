CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  job_type text NOT NULL,
  input jsonb,
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read jobs" ON public.generation_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage jobs" ON public.generation_jobs FOR ALL TO service_role USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;