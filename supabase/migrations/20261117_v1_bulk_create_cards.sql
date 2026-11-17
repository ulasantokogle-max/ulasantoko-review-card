-- V1 ONLY: install exclusively on the isolated UlasanToko V1 database
-- after checking schema and importing + verifying old V1 cards.
-- No records are inserted or modified by this migration itself.
-- The migration gate defaults to false and MUST NOT be opened before audit.
CREATE OR REPLACE FUNCTION public.v1_bulk_create_cards(p_pin_hashes text[])
RETURNS TABLE(card_code text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_number bigint;
  v_hash text;
  v_code text;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF to_regclass('public.v1_migration_gate') IS NULL THEN
    RAISE EXCEPTION 'V1 migration gate is not installed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.v1_migration_gate
     WHERE singleton = true AND imported_and_verified = true
  ) THEN
    RAISE EXCEPTION 'V1 customer data import has not been verified';
  END IF;

  IF coalesce(array_length(p_pin_hashes,1),0) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Batch size must be between 1 and 100';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_pin_hashes) AS t(pin_hash)
    WHERE t.pin_hash IS NULL
       OR t.pin_hash !~ '^[0-9a-f]{32}:[0-9a-f]{128}$'
  ) THEN
    RAISE EXCEPTION 'Invalid activation PIN hash';
  END IF;

  IF to_regclass('public.cards') IS NULL OR (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cards'
      AND column_name IN ('card_code','activation_pin_hash','status')
  ) <> 3 THEN
    RAISE EXCEPTION 'V1 cards schema missing required columns';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='cards'
      AND c.is_nullable='NO' AND c.column_default IS NULL
      AND c.column_name NOT IN ('card_code','activation_pin_hash','status')
      AND c.is_generated='NEVER'
  ) THEN
    RAISE EXCEPTION 'V1 cards schema has additional required fields';
  END IF;

  PERFORM pg_advisory_xact_lock(31749, 1001);
  SELECT coalesce(max(substring(c.card_code FROM '^ULAS-([0-9]+)$')::bigint),0)+1
    INTO v_number FROM public.cards c
    WHERE c.card_code ~ '^ULAS-[0-9]+$';

  FOR v_hash IN SELECT unnest(p_pin_hashes) LOOP
    IF v_number > 999999999 THEN
      RAISE EXCEPTION 'V1 card code range exhausted';
    END IF;

    v_code := 'ULAS-' || lpad(v_number::text,
                               greatest(5,length(v_number::text)), '0');
    INSERT INTO public.cards (card_code,activation_pin_hash,status)
      VALUES (v_code,v_hash,'inactive');

    card_code := v_code;
    RETURN NEXT;
    v_number := v_number + 1;
  END LOOP;
END
$$;
REVOKE ALL ON FUNCTION public.v1_bulk_create_cards(text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v1_bulk_create_cards(text[])
  TO service_role;
