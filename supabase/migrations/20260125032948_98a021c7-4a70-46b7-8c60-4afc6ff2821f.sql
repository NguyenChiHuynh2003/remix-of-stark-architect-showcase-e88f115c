-- Update the upsert_backup_cron function to simply trigger backup-database the same way the manual button does
CREATE OR REPLACE FUNCTION public.upsert_backup_cron(
  _hour integer, 
  _minute integer, 
  _enabled boolean, 
  _base_url text, 
  _anon_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron', 'net'
AS $function$
DECLARE
  job_name text := 'daily-database-backup';
  job_id bigint;
  schedule_text text;
  invoke_sql text;
  target_url text;
BEGIN
  IF _hour IS NULL OR _hour < 0 OR _hour > 23 THEN
    RAISE EXCEPTION 'Invalid hour: % (expected 0-23)', _hour;
  END IF;
  IF _minute IS NULL OR _minute < 0 OR _minute > 59 THEN
    RAISE EXCEPTION 'Invalid minute: % (expected 0-59)', _minute;
  END IF;

  -- Ensure base url is present
  IF _base_url IS NULL OR length(trim(_base_url)) = 0 THEN
    RAISE EXCEPTION 'Missing base URL';
  END IF;

  target_url := rtrim(_base_url, '/') || '/functions/v1/backup-database';

  -- Unschedule existing job(s) with the same name
  FOR job_id IN
    SELECT jobid FROM cron.job WHERE jobname = job_name
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;

  IF NOT COALESCE(_enabled, true) THEN
    RETURN;
  END IF;

  -- minute hour * * * (UTC)
  schedule_text := format('%s %s * * *', _minute, _hour);

  -- Build SQL that cron will run: call net.http_post with auth header using cron_token
  invoke_sql := format(
    'select net.http_post(url:=%L, headers:=%L::jsonb, body:=%L::jsonb) as request_id;',
    target_url,
    json_build_object(
      'Content-Type','application/json',
      'Authorization', 'Bearer ' || _anon_key
    )::text,
    '{}'::text
  );

  PERFORM cron.schedule(job_name, schedule_text, invoke_sql);
END;
$function$;