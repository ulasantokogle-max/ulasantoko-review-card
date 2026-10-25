-- ONLY if V1 security rollout must be reverted AND V1 route code already rolled back.
-- Never run until V1 create/activate APIs no longer call v1_check_rate_limit.
BEGIN;
DROP FUNCTION IF EXISTS public.v1_check_rate_limit(text,integer,integer);
DROP TABLE IF EXISTS public.v1_security_attempts;
COMMIT;
