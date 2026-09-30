# UlasanToko Google Review Card V3

V3 lives inside this repository, but is intentionally isolated from V1/V2.

## Isolation rules

- V1/V2 schema and application code are not modified by V3 migrations.
- V3 uses its own `v3_` PostgreSQL table namespace.
- V3 should use a dedicated Supabase project/database in production.
- V3 routes/API must use the V3 tables only.
- QR/NFC provisioning is admin-side; customers do not create QR/NFC from the landing editor.
- QR supports custom foreground/background colors; no custom logo.
- Low ratings (1–3) are stored as private feedback with optional name/phone and are not sent to Google Review.
- Analytics are event-based and support hourly, daily, weekly, and monthly aggregation.

## Migration

Run `supabase/v3/migrations/001_v3_foundation.sql` against the dedicated V3 Supabase database.

The migration is deliberately namespaced with `v3_` tables so it cannot collide with the existing legacy `public.cards` or V2 tables.

## Planned public flow

`QR/NFC -> V3 domain -> card router -> v3_cards -> published landing -> review/feedback`

The physical QR/NFC destination should use the official V3 domain, never a deployment URL.
