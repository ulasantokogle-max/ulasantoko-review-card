-- V1 ONLY / READ-ONLY: Jalankan sebelum migrasi di project Supabase ulasantoko-review.
-- Tidak membuat atau mengubah data apa pun.
SELECT current_database() AS database_name, current_schema() AS schema_name;
SELECT
  to_regclass('public.cards') AS v1_cards,
  to_regclass('public.v1_security_attempts') AS v1_rate_limit_table;
SELECT count(*) AS total_v1_cards,
       count(*) FILTER (WHERE status='active') AS active_cards,
       count(*) FILTER (WHERE status='inactive') AS inactive_cards
FROM public.cards;
SELECT card_code, status, business_name,
       (google_review_url IS NOT NULL) AS has_review_url
FROM public.cards
WHERE card_code IN ('ULAS-00171','ULAS-00201')
ORDER BY card_code;
SELECT EXISTS(
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='v1_check_rate_limit'
) AS migration_function_present;
