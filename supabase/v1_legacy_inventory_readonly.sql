-- RUN ONLY ON RECOVERED LEGACY V1 DATABASE (read-only)
-- This does not export sensitive rows; use a secure database backup tool to do that.
SELECT
  count(*) AS all_cards,
  count(*) FILTER (WHERE status='active') AS active_cards,
  count(*) FILTER (WHERE status='inactive') AS inactive_cards,
  count(*) FILTER (WHERE status NOT IN ('active','inactive','blocked')) AS other_status_cards,
  count(DISTINCT card_code) AS unique_codes,
  count(*) FILTER (WHERE card_code !~ '^ULAS-[0-9]{5,}$') AS unexpected_codes,
  count(*) FILTER (WHERE status='active' AND
      (google_review_url IS NULL OR google_review_url='')) AS active_missing_review_url,
  count(*) FILTER (WHERE activation_pin_hash IS NULL) AS missing_pin_hash,
  max(substring(card_code from '^ULAS-([0-9]+)$')::bigint) AS largest_numeric_code
FROM public.cards;

-- A reproducible fingerprint to compare source/target without exposing plaintext PINs or URLs:
SELECT md5(coalesce(string_agg(
  md5(coalesce(card_code,'') || '|' || coalesce(status,'') || '|' ||
      coalesce(business_name,'') || '|' ||
      coalesce(google_review_url,'') || '|' ||
      coalesce(activation_pin_hash,'')),
  '' ORDER BY card_code
),'')) AS inventory_fingerprint
FROM public.cards;

SELECT
  count(*) AS duplicate_code_groups
FROM (
  SELECT card_code FROM public.cards GROUP BY card_code HAVING count(*)>1
) d;
