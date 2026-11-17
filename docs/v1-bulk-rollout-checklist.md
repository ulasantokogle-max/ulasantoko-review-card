# V1 Bulk Create / Bulk Designer — rollout checklist

Scope: **UlasanToko V1 only**. Do not merge or deploy to V3, WiV1, or shared domains.

## Files
- `app/admin/provider/bulk-create/page.tsx`: authenticated UI, batch 1–100, one-time PIN CSV.
- `app/api/v1/provider/bulk-create/route.ts`: server-side Provider session, rate limit, atomic RPC.
- `app/admin/provider/bulk-designer/page.tsx`: CSV import, rainbow/blue/dark QR, 10×10 cm, A3 landscape print-to-PDF, two-sided proof.
- `supabase/migrations/20261117_v1_bulk_create_cards.sql`: V1-only transactional code allocator, service-role-only execute.

## Blockers / safety gates
1. **Supabase V1 (ulasantoko-review) is INACTIVE**. Restoring was denied by Supabase free plan's two-active-project quota. Do not pause V3 or WiV1. Upgrade quota or obtain a dedicated V1 project and validated migration/data restoration before production.
2. V1's Vercel project is not visible in the connected Vercel account, so production deployment cannot be verified here.
3. Backup V1 cards, verify deployed environment points to the correct V1 database, then apply SQL **only** on the V1 database. This migration is not yet applied.
4. Build `npm ci && npm run build` in V1 repository and perform independent tests.
5. Confirm V1 Provider login and session, create 1-card test batch, create 10-card test batch, verify sequential unique codes and one-time PINs, then check activation/r-v1 route and existing cards.
6. Validate QR images with multiple phones/Google Lens; verify that the rainbow palette remains readable.
7. Confirm A3 front/back print registration with the actual printer/paper orientation; use a pilot print before bulk production. PDF comes from browser Print > Save as PDF (not a server-generated PDF).
8. Deploy only this V1 project, confirm domain `app.ulasantoko.space`, and monitor logs. Do not change `ulasantoko.space` Short.io mappings in bulk.

## Important
- The V1 rate limiter is fail-closed. If Supabase is paused or the RPC is unavailable, Provider login and card creation may show a 429. This is not evidence of a wrong Provider key.
- Activation PINs are only returned when the batch is created; download and protect the CSV immediately. Avoid logging, posting, or sharing the CSV publicly.
- Never automatically retry a failed bulk creation without auditing whether the transaction committed.
