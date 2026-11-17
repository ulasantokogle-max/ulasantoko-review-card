-- Reference schema for NEW isolated Supabase project ONLY.
-- Applied to project pkgdtrasmakjeykhvxhh, migration v1_initial_isolated_schema_with_import_gate.
-- Do not apply to old V1, V2, YukReview V3, or WiV1.
-- Legacy card data must be recovered separately; this file intentionally inserts no cards.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 card_code text NOT NULL UNIQUE,
 activation_pin_hash text,
 business_name text,
 google_review_url text,
 status text NOT NULL DEFAULT 'inactive',
 activated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS v1_cards_status_idx ON public.cards(status);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cards FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.cards TO service_role;

CREATE TABLE IF NOT EXISTS public.v1_security_attempts (
 bucket text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0,
 window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.v1_security_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.v1_security_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.v1_security_attempts TO service_role;

CREATE TABLE IF NOT EXISTS public.v1_migration_gate (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
 imported_and_verified boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.v1_migration_gate(singleton,imported_and_verified)
 VALUES(true,false) ON CONFLICT(singleton) DO NOTHING;
ALTER TABLE public.v1_migration_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.v1_migration_gate FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.v1_migration_gate TO service_role;

CREATE OR REPLACE FUNCTION public.v1_check_rate_limit(
 p_bucket text,p_limit integer,p_window_seconds integer
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_attempts integer;
BEGIN
 IF p_bucket IS NULL OR length(p_bucket) NOT BETWEEN 1 AND 160
    OR p_limit IS NULL OR p_limit<1
    OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
  RAISE EXCEPTION 'invalid rate limit parameters';
 END IF;
 INSERT INTO public.v1_security_attempts(bucket,attempts,window_start)
 VALUES(p_bucket,1,now())
 ON CONFLICT(bucket) DO UPDATE SET
  attempts=CASE WHEN v1_security_attempts.window_start < now()-(p_window_seconds*interval '1 second')
    THEN 1 ELSE v1_security_attempts.attempts+1 END,
  window_start=CASE WHEN v1_security_attempts.window_start < now()-(p_window_seconds*interval '1 second')
    THEN now() ELSE v1_security_attempts.window_start END
 RETURNING attempts INTO v_attempts;
 RETURN v_attempts <= p_limit;
END $$;
REVOKE ALL ON FUNCTION public.v1_check_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v1_check_rate_limit(text,integer,integer) TO service_role;

-- New project's automatic RLS event trigger function remains active, but API callers can't invoke it.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated;

-- Bulk RPC is defined in 20261117_v1_bulk_create_cards.sql.
-- The RPC requires v1_migration_gate.imported_and_verified=true, set ONLY after
-- all legacy cards have been imported, validated and backup verified.
