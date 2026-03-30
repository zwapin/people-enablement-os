ALTER TABLE public.curricula ADD COLUMN categories jsonb DEFAULT '[]'::jsonb;
UPDATE public.curricula SET categories = jsonb_build_array(category) WHERE category IS NOT NULL;
ALTER TABLE public.curricula DROP COLUMN category;