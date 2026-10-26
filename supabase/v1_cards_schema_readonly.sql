-- V1 schema evidence, READ ONLY. Run on Supabase SQL Editor using role postgres.
-- Save the Results as CSV; this is NOT a full restore backup.
SELECT c.column_name,c.data_type,c.is_nullable,c.column_default
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name='cards'
ORDER BY c.ordinal_position;
SELECT con.conname, pg_get_constraintdef(con.oid) definition
FROM pg_constraint con WHERE con.conrelid='public.cards'::regclass;
SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='cards';
SELECT relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class WHERE oid='public.cards'::regclass;
SELECT policyname,cmd,roles,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename='cards';
