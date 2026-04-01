
-- Team tools table
CREATE TABLE public.team_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team text NOT NULL,
  name text NOT NULL,
  icon_url text,
  invite_link text,
  order_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on team_tools"
  ON public.team_tools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reps can view team_tools"
  ON public.team_tools FOR SELECT TO authenticated
  USING (true);
