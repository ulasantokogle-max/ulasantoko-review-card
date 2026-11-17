# V1 migration plan — separate Supabase Free account

**Scope:** UlasanToko V1 only. Never modify YukReview V3, WiV1, or the Digital Business Card SaaS. This is a preparation plan, not an executed database migration.

## Verified starting state (17 November 2026)

- Old V1 Supabase project: `mnpherdmkecbogomzlnk`, name `ulasantoko-review`, region `ap-northeast-2`, status `INACTIVE`.
- Old account's two active projects: V3 `sflwutmloshwijnejtqc`, WiV1 `fzzburisxfnyurkkcqbl`.
- Free plan active-project quota blocked restoring old V1.
- New Supabase account/project has **not** yet been connected/created.
- V1 feature branch: `feature/v1-bulk-create-designer-isolated`; draft PR #8 is **not** merged.
- V1 production hosting ownership/credentials and old database backup availability must be independently established.

## Stage A — Separate identity and connect ChatGPT

1. Create/sign into a Supabase account with a **different identity/login** from the account owning the two active free projects. Creating another organization under the existing user does not bypass its two-active-free-project limit.
2. Use a distinct Free organization, project name `ulasantoko-v1-production`, region `ap-southeast-1`, and store the generated database password in a password manager.
3. In ChatGPT: Settings > Plugins > Supabase > Connected accounts > Connect another account (when available). Authorize **the new account**. Preserve the existing connection to the old account if multiple connections are supported; do not disconnect it automatically.
4. Confirm the new `project_ref` and organization are visible to the authorized connection before any SQL or Vercel changes. Never paste service_role, database passwords, access tokens, or connection strings into chat.

## Stage B — Old V1 data preservation (mandatory)

1. Determine whether a verified export / logical backup of the old V1 project exists. Inspect paused-project controls and/or an independently held backup. Free plan does not guarantee downloadable database backups.
2. **Do not initialize new production from an empty `cards` table or repoint V1** if existing physical cards are expected to work. If no recoverable backup exists, stop cutover; investigate recovery/transfer options with Supabase.
3. Recover complete V1 data and schema (including `cards`, `activation_pin_hash`, `status`, `business_name`, `google_review_url`, timestamps, constraints, RLS, RPCs, and any V1-specific supporting tables).
4. Verify same `ULAS-xxxxx` codes, counts, status values, and review targets. Never generate new PINs for existing cards or remap QR/NFC IDs.
5. Old `ulasantoko.space` Short.io mappings and `app.ulasantoko.space/r-v1/ULAS-xxxxx` routes must remain stable.

## Stage C — New project dry-run and V1-only migration

1. Restore/import V1 backup to the dedicated new project; if the backup format is dashboard `.backup` vs logical `.sql`, follow the relevant current Supabase restoration guide.
2. Confirm auth/storage/extensions/functions and server side service-role access independently. Ensure V1 service-role secrets never reach the browser.
3. On **new V1 database only**, run `supabase/v1_bulk_create_preflight_readonly.sql`. Confirm required `cards` columns, uniqueness, and rate limiter RPC.
4. Apply V1 rate-limit SQL only if absent and required, then `supabase/migrations/20261117_v1_bulk_create_cards.sql` only if preflight conditions are met. Verify execution grants and RLS.
5. Before any production switch, create exactly one dummy test card and verify inactive activation, active review redirect, PIN validation, 10-card atomic bulk creation, CSV and print preview; never share activation PINs outside secure storage.

## Stage D — Isolated V1 deployment and controlled cutover

1. Confirm exact owner/project/deployment for `ulasantoko-review-card` on Vercel. The connected Vercel account may not have access; **do not** deploy into V3 or WiV1 as a workaround.
2. Update env **only for V1 deployment**, after backup and restore acceptance. Relevant env names include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (if used by V1), `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_KEY`, `V1_RATE_LIMIT_SECRET`. Never log or paste values.
3. Confirm V1 host `app.ulasantoko.space` on preview, verify HTTPS, run existing V1 regression tests and test physical card codes and Google Review destination mapping before production.
4. Switch only the V1 deployment, with rollback plan that preserves all old IDs and stored cards; monitor errors. Do not alter V3 or WiV1 projects/DB/DNS.
5. Keep PR #8 unmerged until the database is actually recovered and end-to-end acceptance tests pass.

## Important Free-tier limitations

- The two-active-Free-project limit is scoped to the account's Owner/Admin organization memberships (not merely organization count).
- Free projects may pause after low activity; production needs a monitoring/backups plan and may warrant Pro when uptime becomes critical.
- A new Free database does **not** automatically include a paused project's existing records. An independently verified backup, approved transfer, or recovery is a hard precondition.

## Public references

- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/migrating-within-supabase
- https://supabase.com/docs/guides/platform/project-transfer
- https://supabase.com/docs/guides/platform/backups
