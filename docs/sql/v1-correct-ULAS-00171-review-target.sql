-- V1 ONE-CARD CORRECTION: execute manually in the V1 Supabase SQL Editor ONLY
-- after independently confirming the Place ID belongs to the intended BEARD business.
-- This script does not modify schemas or touch V2/V3 records.
BEGIN;
DO $$
DECLARE
  target_count integer;
BEGIN
  SELECT count(*) INTO target_count
  FROM public.cards
  WHERE card_code = 'ULAS-00171'
    AND business_name = 'BEARD'
    AND status = 'active';
  IF target_count <> 1 THEN
    RAISE EXCEPTION 'ABORT: expected exactly 1 active BEARD card ULAS-00171, found %', target_count;
  END IF;
  UPDATE public.cards
  SET google_review_url = 'https://search.google.com/local/writereview?placeid=ChIJ3TxKYe2PaS4Rfaw-v6hZ358',
      updated_at = NOW()
  WHERE card_code = 'ULAS-00171'
    AND business_name = 'BEARD'
    AND status = 'active';
END $$;
SELECT card_code, business_name, status, google_review_url
FROM public.cards WHERE card_code = 'ULAS-00171';
COMMIT;
