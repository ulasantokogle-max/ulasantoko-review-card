-- V1-only persistent rate limits. Run in V1 database ONLY after backup, before releasing the rate-limited routes.
CREATE TABLE IF NOT EXISTS public.v1_security_attempts (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.v1_security_attempts FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.v1_check_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_attempts integer;
BEGIN
  IF length(p_bucket) > 160 OR p_limit < 1 OR p_window_seconds < 1 THEN RAISE EXCEPTION 'invalid rate limit'; END IF;
  INSERT INTO public.v1_security_attempts(bucket, attempts, window_start) VALUES(p_bucket,1,now())
  ON CONFLICT(bucket) DO UPDATE SET
    attempts = CASE WHEN v1_security_attempts.window_start < now() - (p_window_seconds * interval '1 second')
      THEN 1 ELSE v1_security_attempts.attempts + 1 END,
    window_start = CASE WHEN v1_security_attempts.window_start < now() - (p_window_seconds * interval '1 second')
      THEN now() ELSE v1_security_attempts.window_start END
  RETURNING attempts INTO v_attempts;
  RETURN v_attempts <= p_limit;
END $$;
REVOKE ALL ON FUNCTION public.v1_check_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v1_check_rate_limit(text,integer,integer) TO service_role;
