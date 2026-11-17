-- V1 ONLY. Run manually on the restored ulasantoko-review Supabase project.
-- Atomic numbering and insertion; does not update existing card rows.
CREATE OR REPLACE FUNCTION public.v1_bulk_create_cards(p_pin_hashes text[])
RETURNS TABLE(card_code text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  next_number bigint;
  item_hash text;
  new_code text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF coalesce(array_length(p_pin_hashes,1),0) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Count must be 1 to 100';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_pin_hashes) AS h(pin_hash) WHERE h.pin_hash !~ '^[0-9a-f]{32}:[0-9a-f]{128}) THEN
    RAISE EXCEPTION 'Invalid PIN hash';
  END IF;
  -- Refuse to modify an unexpected schema. V1 existing data must remain untouched.
  IF to_regclass('public.cards') IS NULL OR
     (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='cards'
        AND column_name IN ('card_code','activation_pin_hash','status')) <> 3 THEN
    RAISE EXCEPTION 'V1 cards schema missing required columns';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='cards'
      AND c.is_nullable='NO' AND c.column_default IS NULL
      AND c.column_name NOT IN ('card_code','activation_pin_hash','status')
      AND c.is_generated='NEVER'
  ) THEN
    RAISE EXCEPTION 'V1 cards schema requires additional fields; review table before creating cards';
  END IF;
  PERFORM pg_advisory_xact_lock(31749,1001);
  SELECT coalesce(max(substring(c.card_code from '^ULAS-([0-9]+)$')::bigint),0)+1
    INTO next_number
    FROM public.cards AS c WHERE c.card_code ~ '^ULAS-[0-9]+$';
  FOR item_hash IN SELECT unnest(p_pin_hashes) LOOP
    IF next_number > 999999999 THEN RAISE EXCEPTION 'Code range exhausted'; END IF;
    new_code := 'ULAS-' || lpad(next_number::text, greatest(5,length(next_number::text)), '0');
    INSERT INTO public.cards(card_code,activation_pin_hash,status)
      VALUES(new_code,item_hash,'inactive');
    card_code := new_code;
    RETURN NEXT;
    next_number := next_number + 1;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.v1_bulk_create_cards(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v1_bulk_create_cards(text[]) TO service_role;
) THEN
    RAISE EXCEPTION 'Invalid PIN hash';
  END IF;
  -- Refuse to modify an unexpected schema. V1 existing data must remain untouched.
  IF to_regclass('public.cards') IS NULL OR
     (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='cards'
        AND column_name IN ('card_code','activation_pin_hash','status')) <> 3 THEN
    RAISE EXCEPTION 'V1 cards schema missing required columns';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='cards'
      AND c.is_nullable='NO' AND c.column_default IS NULL
      AND c.column_name NOT IN ('card_code','activation_pin_hash','status')
      AND c.is_generated='NEVER'
  ) THEN
    RAISE EXCEPTION 'V1 cards schema requires additional fields; review table before creating cards';
  END IF;
  PERFORM pg_advisory_xact_lock(31749,1001);
  SELECT coalesce(max(substring(c.card_code from '^ULAS-([0-9]+)$')::bigint),0)+1
    INTO next_number
    FROM public.cards AS c WHERE c.card_code ~ '^ULAS-[0-9]+$';
  FOR item_hash IN SELECT unnest(p_pin_hashes) LOOP
    IF next_number > 999999999 THEN RAISE EXCEPTION 'Code range exhausted'; END IF;
    new_code := 'ULAS-' || lpad(next_number::text, greatest(5,length(next_number::text)), '0');
    INSERT INTO public.cards(card_code,activation_pin_hash,status)
      VALUES(new_code,item_hash,'inactive');
    card_code := new_code;
    RETURN NEXT;
    next_number := next_number + 1;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.v1_bulk_create_cards(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v1_bulk_create_cards(text[]) TO service_role;
