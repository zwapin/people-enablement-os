
-- 1. Extend onboarding_plans
ALTER TABLE public.onboarding_plans
  ADD COLUMN premessa text,
  ADD COLUMN output_atteso text;

-- 2. Extend onboarding_milestones
ALTER TABLE public.onboarding_milestones
  ADD COLUMN obiettivo text,
  ADD COLUMN focus jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN early_warnings jsonb DEFAULT '[]'::jsonb;
-- Rename goals to kpis
ALTER TABLE public.onboarding_milestones RENAME COLUMN goals TO kpis;

-- 3. Extend onboarding_tasks
ALTER TABLE public.onboarding_tasks
  ADD COLUMN section text,
  ADD COLUMN order_index integer DEFAULT 0,
  ADD COLUMN is_common boolean DEFAULT false;

-- 4. Create onboarding_templates table
CREATE TABLE public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type public.task_type DEFAULT 'activity'::task_type NOT NULL,
  section text,
  milestone_label public.milestone_label DEFAULT '30d'::milestone_label NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on templates"
  ON public.onboarding_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reps can view templates"
  ON public.onboarding_templates FOR SELECT
  TO authenticated
  USING (true);
