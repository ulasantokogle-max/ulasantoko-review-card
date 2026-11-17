-- Target ONLY: isolated Supabase project ulasantoko-v1-production
-- Additional consistency rule matching the legacy V1 schema.
-- This is additive. It does not create, delete, or update any card data.
ALTER TABLE public.cards
  ADD CONSTRAINT cards_v1_status_check
  CHECK (status IN ('inactive','active','blocked'));
