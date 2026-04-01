
-- Add departments (jsonb array) to support multi-team membership
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS departments jsonb DEFAULT '[]'::jsonb;

-- Migrate existing department data into departments array
UPDATE public.profiles SET departments = jsonb_build_array(department) WHERE department IS NOT NULL AND department != '' AND (departments IS NULL OR departments = '[]'::jsonb);

-- Add member_type to distinguish New Klaaryan vs Veteran Klaaryan
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_type text DEFAULT 'new_klaaryan';
