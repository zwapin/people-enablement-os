-- Enums
CREATE TYPE public.module_status AS ENUM ('draft', 'published');
CREATE TYPE public.plan_status AS ENUM ('active', 'archived');
CREATE TYPE public.milestone_label AS ENUM ('30d', '60d', '90d');
CREATE TYPE public.task_type AS ENUM ('module_link', 'activity', 'meeting');

-- Modules
CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary varchar(300),
  content_body text,
  key_points jsonb DEFAULT '[]',
  track text NOT NULL DEFAULT 'General',
  order_index integer NOT NULL DEFAULT 0,
  status module_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view published modules" ON public.modules
  FOR SELECT TO authenticated USING (status = 'published');
CREATE POLICY "Admins can view all modules" ON public.modules
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert modules" ON public.modules
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update modules" ON public.modules
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete modules" ON public.modules
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Assessment questions
CREATE TABLE public.assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_index integer NOT NULL DEFAULT 0,
  feedback_correct text,
  feedback_wrong text,
  order_index integer NOT NULL DEFAULT 0
);
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view questions of published modules" ON public.assessment_questions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.modules WHERE id = module_id AND status = 'published')
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins can insert questions" ON public.assessment_questions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update questions" ON public.assessment_questions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete questions" ON public.assessment_questions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Module completions
CREATE TABLE public.module_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 1,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);
ALTER TABLE public.module_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own completions" ON public.module_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions" ON public.module_completions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all completions" ON public.module_completions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Onboarding plans
CREATE TABLE public.onboarding_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  created_by uuid NOT NULL,
  role_template text,
  plan_status plan_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps can view own plans" ON public.onboarding_plans
  FOR SELECT TO authenticated USING (auth.uid() = rep_id);
CREATE POLICY "Admins can do everything on plans" ON public.onboarding_plans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Onboarding milestones
CREATE TABLE public.onboarding_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.onboarding_plans(id) ON DELETE CASCADE,
  label milestone_label NOT NULL,
  goals jsonb NOT NULL DEFAULT '[]'
);
ALTER TABLE public.onboarding_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps can view own milestones" ON public.onboarding_milestones
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_plans WHERE id = plan_id AND rep_id = auth.uid())
  );
CREATE POLICY "Admins can do everything on milestones" ON public.onboarding_milestones
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Onboarding tasks
CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES public.onboarding_milestones(id) ON DELETE CASCADE,
  title text NOT NULL,
  type task_type NOT NULL DEFAULT 'activity',
  module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz
);
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps can view own tasks" ON public.onboarding_tasks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_milestones m
      JOIN public.onboarding_plans p ON p.id = m.plan_id
      WHERE m.id = milestone_id AND p.rep_id = auth.uid()
    )
  );
CREATE POLICY "Reps can update own tasks" ON public.onboarding_tasks
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_milestones m
      JOIN public.onboarding_plans p ON p.id = m.plan_id
      WHERE m.id = milestone_id AND p.rep_id = auth.uid()
    )
  );
CREATE POLICY "Admins can do everything on tasks" ON public.onboarding_tasks
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));