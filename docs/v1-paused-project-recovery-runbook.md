# UlasanToko V1 – recovery from paused source to isolated Free database

**Only V1; do not transfer, pause, delete, or change V3/WiV1.**

Source: `mnpherdmkecbogomzlnk` (`ulasantoko-review`, old Supabase account), INACTIVE.  
Target: `pkgdtrasmakjeykhvxhh` (`ulasantoko-v1-production`, *new* Supabase account), ACTIVE_HEALTHY.

## Required dashboard-only operation (no transfer action available in the connected tooling)
Supabase official instructions: https://supabase.com/docs/guides/platform/project-transfer

1. In target organization's Team settings, invite the **old account** as a member (least privilege supported by the plan; don't change V3/WiV1 membership).
2. Using the **old account**, open source V1 project Settings → General → Transfer Project, and choose organization `ULASANTOKO V1`.
3. Confirm requirements: source-org Owner, target-org member, no active GitHub integration on source, and target Free quotas. This transfers **only old V1 project**, not the active V3/WiV1 projects. It may not be supported while paused; if unavailable, use Supabase Support/backup-download path. Never attempt transfer into the old organization.
4. The target org will then contain two projects: `ulasantoko-v1-production` (empty staging target) and the transferred **old** V1 project. Restore the transferred old V1 only if eligible; check actual quota and project status first.
5. Run `supabase/v1_legacy_inventory_readonly.sql` on restored **old V1** (read-only) and archive counts/fingerprint. Obtain a **verified data backup**, preserving IDs, PIN hashes, status, business name, review URL, timestamps, schema, constraints, and any other used V1 tables.
6. Before importing into the new target, perform a structural diff. Reconcile any extra legacy columns with the target table; do not run destructive DROP/REPLACE on either project. Use backup/restore with an explicit source/target mapping. **Never import mixed V3/V1 spreadsheets** as though they were full database backups.
7. Validate row counts, unique codes, active/inactive counts, max code, verified samples, and inventory fingerprint on the new target. Confirm all **old physical V1 URLs** continue to match their original card/code and business mapping.
8. Only after audited sign-off open `v1_migration_gate.imported_and_verified` on the **new** project. Test a 1-card batch, activation, QR and NFC redirects.
9. On a separately verified V1 Vercel project, configure dedicated `V1_SUPABASE_URL` and `V1_SUPABASE_SERVICE_ROLE_KEY` as secret env vars. Keep shared V2 env unchanged. Do not put secrets in chat or GitHub.
10. Do not move `app.ulasantoko.space` until the new version, old card mappings, rollback deployment, and QR/NFC proof are checked. Test duplex print registration on physical A3.

If transfer is unavailable or backup data cannot be recovered, **stop production cutover**. Leave the new DB migration gate closed and old project untouched. Supabase support: https://supabase.com/dashboard/support

## Current verified state
- New V1 database has 0 cards, all three tables secured with RLS and closed public access.
- Bulk create RPC and rate limiter tested inside rolled-back transactions; zero test records persist.
- GitHub PR #8 includes V1-isolated data connection and Provider tools; keep draft until backup restored.
- Vercel project ownership is not currently available through connected Vercel account; GitHub preview may pass without production access.
