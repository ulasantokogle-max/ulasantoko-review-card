-- READ ONLY: run on the restored V1 database before applying the V1 bulk migration.
-- Do NOT run against V3 or WiV1.
SELECT current_database() AS database_name,
       to_regclass('public.cards') IS NOT NULL AS cards_table_exists,
       to_regprocedure('public.v1_check_rate_limit(text,integer,integer)') IS NOT NULL AS rate_limit_rpc_exists;

SELECT c.column_name, c.data_type, c.is_nullable, c.column_default
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name='cards'
ORDER BY c.ordinal_position;

-- Expected required fields: card_code, activation_pin_hash, status.
-- Review any other NOT NULL fields without defaults before the new RPC is applied.
SELECT c.column_name AS additional_mandatory_field
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name='cards'
  AND c.is_nullable='NO'
  AND c.column_default IS NULL
  AND c.is_generated='NEVER'
  AND c.column_name NOT IN ('card_code','activation_pin_hash','status');

-- Verify existing unique code constraint, and inspect the next candidate.
SELECT count(*) AS existing_cards,
       count(DISTINCT card_code) AS distinct_codes,
       max(substring(card_code from '^ULAS-([0-9]+)$')::bigint) AS max_numeric_code
FROM public.cards;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='cards'
ORDER BY indexname;
