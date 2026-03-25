
CREATE POLICY "Admins can insert jobs"
ON public.generation_jobs
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update jobs"
ON public.generation_jobs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
