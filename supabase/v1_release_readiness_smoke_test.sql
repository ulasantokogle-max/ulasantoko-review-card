-- UlasanToko V1 ONLY — isolated target pkgdtrasmakjeykhvxhh
-- Transactional smoke test. NEVER run on old V1, V2, V3 or WiV1.
-- All temporary cards, activation and gate changes are rolled back.
-- Run in SQL Editor, confirm final cards_after_rollback=0 and gate_after_rollback=false.
BEGIN;
SET LOCAL ROLE service_role;
UPDATE public.v1_migration_gate
SET imported_and_verified = true WHERE singleton = true;
DO $$
DECLARE v_codes text[]; v_active text; v_inactive text; v_rows integer;
BEGIN
  SELECT array_agg(card_code ORDER BY card_code) INTO v_codes FROM
    public.v1_bulk_create_cards(ARRAY[
      repeat('a',32)||':'||repeat('1',128),
      repeat('b',32)||':'||repeat('2',128)
    ]::text[]);
  IF coalesce(array_length(v_codes,1),0) <> 2 OR v_codes[1] = v_codes[2]
    THEN RAISE EXCEPTION 'V1 issuance failed';
  END IF;
  v_active := v_codes[1]; v_inactive := v_codes[2];
  UPDATE public.cards SET status='active', business_name='V1 ROLLBACK TEST',
    google_review_url='https://search.google.com/local/writereview?placeid=ChIJTESTV1Only',
    activated_at=now(),updated_at=now()
   WHERE card_code=v_active AND status='inactive';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'V1 activation failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cards WHERE card_code=v_active
      AND status='active' AND google_review_url='https://search.google.com/local/writereview?placeid=ChIJTESTV1Only')
    THEN RAISE EXCEPTION 'V1 review link mapping failed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cards WHERE card_code=v_inactive
    AND status='inactive') THEN RAISE EXCEPTION 'V1 inactive status failed'; END IF;
END $$;
ROLLBACK;
SELECT (SELECT count(*) FROM public.cards) cards_after_rollback,
       (SELECT imported_and_verified FROM public.v1_migration_gate
        WHERE singleton=true) gate_after_rollback;
