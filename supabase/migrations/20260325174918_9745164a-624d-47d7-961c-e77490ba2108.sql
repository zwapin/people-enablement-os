
-- Create curricula table
CREATE TABLE public.curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  track text NOT NULL DEFAULT 'Generale',
  order_index integer NOT NULL DEFAULT 0,
  status public.module_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.curricula ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can do everything on curricula"
ON public.curricula FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reps can view published
CREATE POLICY "Reps can view published curricula"
ON public.curricula FOR SELECT TO authenticated
USING (status = 'published');

-- Add curriculum_id to modules
ALTER TABLE public.modules ADD COLUMN curriculum_id uuid REFERENCES public.curricula(id) ON DELETE SET NULL;
