
-- Update RLS: allow all authenticated users to view ALL curricula (not just published)
DROP POLICY IF EXISTS "Reps can view published curricula" ON public.curricula;
CREATE POLICY "Authenticated users can view all curricula" ON public.curricula
  FOR SELECT TO authenticated USING (true);

-- Update RLS: allow all authenticated users to view ALL modules (not just published)
DROP POLICY IF EXISTS "Authenticated users can view published modules" ON public.modules;
CREATE POLICY "Authenticated users can view all modules" ON public.modules
  FOR SELECT TO authenticated USING (true);
