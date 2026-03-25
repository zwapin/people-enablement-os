-- Add new values to module_status enum
ALTER TYPE public.module_status ADD VALUE IF NOT EXISTS 'proposed';
ALTER TYPE public.module_status ADD VALUE IF NOT EXISTS 'archived';

-- Add new columns to modules table
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS source_document_ids jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_faq_ids jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_rationale text DEFAULT NULL;

-- Update RLS: allow reps to also see proposed modules (they shouldn't, but admins need to see them)
-- No change needed - admins can already see all modules, reps only see published