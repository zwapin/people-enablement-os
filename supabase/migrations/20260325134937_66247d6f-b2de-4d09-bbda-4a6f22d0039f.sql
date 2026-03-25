ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES generation_jobs(id) ON DELETE CASCADE;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS current_step text;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS total_steps integer DEFAULT 0;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS completed_steps integer DEFAULT 0;