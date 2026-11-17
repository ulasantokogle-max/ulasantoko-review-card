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
3. Backup V1 cards, verify deployed environment points to the correct V1 database, run read-only `supabase/v1_bulk_create_preflight_readonly.sql` and review its results. Only then apply the migration **on V1**. This migration is not yet applied.
4. Confirm clean Next.js build in V1 preview and perform independent tests. This repository currently has no `package-lock.json` in its default branch, so `npm ci` is not appropriate until the lockfile is established.
5. Confirm V1 Provider login and session, create 1-card test batch, create 10-card test batch, verify sequential unique codes and one-time PINs, then check activation/r-v1 route and existing cards.
6. Validate QR images with multiple phones/Google Lens; verify that the rainbow palette remains readable.
7. Confirm A3 front/back print registration with actual printer/paper orientation; use a pilot print before bulk production. PDF comes from browser Print > Save as PDF (not a server-generated PDF). The layout is only a production candidate until physical print registration is verified.
8. Deploy only this V1 project, confirm domain `app.ulasantoko.space`, and monitor logs. Do not change `ulasantoko.space` Short.io mappings in bulk.

## Important
- The V1 rate limiter is fail-closed. If Supabase is paused or the RPC is unavailable, Provider login and card creation may show a 429. This is not evidence of a wrong Provider key.
- Activation PINs are only returned when the batch is created; download and protect the CSV immediately. Avoid logging, posting, or sharing the CSV publicly.
- Never automatically retry a failed bulk creation without auditing whether the transaction committed.

## Migrasi ke akun Supabase Free baru — V1 ONLY

1. Owner membuat akun Supabase **baru** dan organisasi **baru** (jangan join/memakai organisasi V3/WiV1 yang lama); pilih region Singapore `ap-southeast-1` dan nama rencana `ulasantoko-v1-production`. Pastikan kebijakan kuota Free mengizinkan proyek baru.
2. Hubungkan akun Supabase baru ke ChatGPT melalui Settings > Plugins; periksa kembali project/organization ID sebelum tindakan. Jangan mengirim database password, service_role key, token, atau `ADMIN_KEY` di chat.
3. **Jangan membuat database cards kosong sebagai pengganti database lama untuk production.** Seluruh kartu lama akan tampak hilang jika aplikasi tiba-tiba diarahkan ke database kosong.
4. Peroleh **backup konsisten dari V1 lama** (schema, `public.cards`, kode, status, PIN hash, link review, timestamps, constraints/indexes, policy dan RPC). Sumber lama `mnpherdmkecbogomzlnk` saat ini INACTIVE. Selidiki opsi backup-download/restore di dashboard akun lama, atau pulihkan sementara kapasitas untuk export. Jangan memindahkan V3 atau WiV1.
5. Backup lama mungkin memuat data sensitif; lakukan restore menggunakan prosedur resmi di lingkungan dengan akses terbatas, jangan bagikan dump atau secrets ke chat. Verifikasi jumlah kartu, `card_code`, status dan review target, duplicate code, dan 5 sampel kartu aktif/nonaktif.
6. Pada database V1 baru saja: pulihkan schema/data V1 lama terlebih dulu; jalankan `supabase/v1_bulk_create_preflight_readonly.sql`; terapkan `v1_security_rate_limit.sql` bila belum tersedia dan migrasi `20261117_v1_bulk_create_cards.sql` setelah audit struktur.
7. Proyek hosting V1 harus dapat diakses secara terpisah; atur `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` secara eksklusif pada environment aplikasi **V1**. Jaga `ADMIN_KEY` dan `V1_RATE_LIMIT_SECRET` tersimpan aman. Jangan gunakan project atau key V3/WiV1.
8. Uji preview terhadap lingkungan isolasi terlebih dahulu. Tanpa backup yang valid, hentikan proses sebelum mengubah environment production atau mapping QR/NFC. Jangan mengubah link fisik `app.ulasantoko.space/r-v1/ULAS-xxxxx`.
9. Untuk cutover: freeze pembuatan/aktivasi kartu V1 seperlunya, final sync jika database lama sudah dapat diakses, verifikasi smoke tests, baru pindahkan koneksi env production **V1** dan lakukan rollout terkendali. Simpan rollback siap pakai.

Status: Dokumen persiapan saja. Tidak ada project Supabase baru yang dibuat dan tidak ada production cutover.
