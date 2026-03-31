
-- Key activities per plan (individual instances)
CREATE TABLE public.onboarding_key_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.onboarding_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  collection_id uuid REFERENCES public.curricula(id) ON DELETE SET NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  order_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_key_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on key_activities"
  ON public.onboarding_key_activities FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reps can view own key_activities"
  ON public.onboarding_key_activities FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_plans p
    WHERE p.id = onboarding_key_activities.plan_id AND p.rep_id = auth.uid()
  ));

CREATE POLICY "Reps can update own key_activities"
  ON public.onboarding_key_activities FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_plans p
    WHERE p.id = onboarding_key_activities.plan_id AND p.rep_id = auth.uid()
  ));

-- Key activity templates per role
CREATE TABLE public.onboarding_key_activity_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  title text NOT NULL,
  collection_id uuid REFERENCES public.curricula(id) ON DELETE SET NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_key_activity_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on key_activity_templates"
  ON public.onboarding_key_activity_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reps can view key_activity_templates"
  ON public.onboarding_key_activity_templates FOR SELECT TO authenticated
  USING (true);

-- Add role column to onboarding_templates
ALTER TABLE public.onboarding_templates ADD COLUMN role text DEFAULT NULL;

-- Seed AE key activity templates
INSERT INTO public.onboarding_key_activity_templates (role, title, order_index) VALUES
  ('AE', 'Completa la formazione Sales Fundamentals', 0),
  ('AE', 'Setup CRM e strumenti di lavoro', 1),
  ('AE', 'Completa la formazione Prodotto', 2),
  ('AE', 'Revisiona playbook commerciale', 3);
