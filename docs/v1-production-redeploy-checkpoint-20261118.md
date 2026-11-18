# V1-only production reconfiguration deployment checkpoint

Date: 2026-11-18 (Asia/Jakarta).

Purpose: trigger a clean Git-linked build after the owner configured
`V1_SUPABASE_URL` and `V1_SUPABASE_SERVICE_ROLE_KEY` in the **V1 project Production environment**.
This file does not contain, request, or publish any credentials.

Preflight audit (read-only):
- Restored legacy V1 project: `mnpherdmkecbogomzlnk`.
- Isolated V1 target: `pkgdtrasmakjeykhvxhh`.
- Both: 23 existing cards, including 12 active cards.
- Fingerprints identical: `dcb6146e3718ebb54bbb59cedaa02f4f`.
- Target migration gate: true.
- All historical QR/card codes, status and Google Review destinations preserved.
- V2, V3 and WiV1 databases, domains and service variables unchanged.

Release verification after the Git-linked deployment:
1. Open V1 Provider > Status Sistem V1; verify mode `isolated`, 23 cards and `ready=true`.
2. Create **one** V1 card and confirm returned code is sequential `ULAS-00206`, PIN shown once, and CSV export works.
3. Test scan of the new QR against V1 activation, then verify its link to Google Review using a real business URL.
4. Check a historical active V1 card still redirects to its original destination and an inactive V1 card still requires its original PIN.
5. Test Bulk Create with a small authorized batch, Bulk Designer QR/NFC print preview and physical scan.
6. Do not change shared V2 variables or any V3/WiV1 deployment.

This markdown-only checkpoint does not change application runtime code.
