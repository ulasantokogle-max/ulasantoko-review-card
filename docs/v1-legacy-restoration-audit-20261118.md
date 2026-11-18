# V1 recovery and data-copy audit — 18 November 2026

## Isolated scope
- Source V1 Supabase: `mnpherdmkecbogomzlnk`, **ACTIVE_HEALTHY** after transfer to organization `ULASANTOKO V1` and restoration.
- Target V1 Supabase: `pkgdtrasmakjeykhvxhh`, **ACTIVE_HEALTHY**.
- Only `public.cards` records were copied. Source rows, V2 tables, V3 and WiV1 were not altered.
- Target migration gate remains closed until approved readiness checks and V1-only hosting connection are secured.

## Audit
| Check | Legacy | Target |
| --- | ---: | ---: |
| Total cards | 23 | 23 |
| Active | 12 | 12 |
| Inactive | 11 | 11 |
| Cards with missing PIN hash | 7 | 7 |
| Active Google Maps short links | 3 | 3 |
| Historical 4-digit code | 1 | 1 |
| Full data fingerprint (MD5 of canonical JSONB records) | `dcb6146e3718ebb54bbb59cedaa02f4f` | `dcb6146e3718ebb54bbb59cedaa02f4f` |

Full record copy preserved IDs, card codes, status, business name, destination, activation PIN hash (including null), and all timestamps. The two additional legacy fields `google_place_id` and `complaint_enabled` were null on all 23 records, so they were omitted in the isolated target. No plain PINs were copied or reconstructed.

### Legacy compatibility
- Short code `ULAS-0031` is an existing inactive legacy record; public redirect and activation validation must accept this 4-digit suffix.
- Three active cards have `https://maps.app.goo.gl/<token>` destinations. Public V1 redirect allowlist must preserve exact Google-owned links, not rewrite them to guessed Place IDs.
- Four inactive cards have no PIN hash; activation must not bypass PIN verification. Those require authorized owner support rather than fabricated PINs.

### Issuance safety check
A **rolled-back** transaction opened the gate temporarily, executed one-card RPC and asserted the next sequential code would be `ULAS-00206`. After rollback the target still contained exactly 23 cards and the gate was false.

### Outstanding production cutover
1. Confirm the source fingerprint remains unchanged; reconcile changes if any cards are created/activated after this snapshot.
2. Complete a V1-only compatibility deploy and ensure redirect tests + V2 CI + Preview build succeed.
3. Restore V1-only Vercel project access and set server-only `V1_SUPABASE_URL` and `V1_SUPABASE_SERVICE_ROLE_KEY` to isolated V1 target, without touching shared variables.
4. Revalidate source/target row parity, then open the migration gate only on isolated target.
5. Test a real 1-card issue/activation plus old QR/NFC destinations on production. Never merge broad PR #8 or change physical URLs without verifying old cards.

**Do not send secrets or PIN hashes to GitHub, chat, or reports.**
