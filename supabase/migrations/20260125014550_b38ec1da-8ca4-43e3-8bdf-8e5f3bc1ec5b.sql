ALTER TABLE public.backup_settings
  ADD COLUMN IF NOT EXISTS cron_token text;

-- Initialize cron_token for existing rows
UPDATE public.backup_settings
SET cron_token = COALESCE(cron_token, gen_random_uuid()::text);

ALTER TABLE public.backup_settings
  ALTER COLUMN cron_token SET DEFAULT gen_random_uuid()::text;