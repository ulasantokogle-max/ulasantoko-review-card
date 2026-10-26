# V1 — Gate kesiapan jual kartu NFC + QR

Scope: **V1 only**. Jangan mengedit, men-deploy ulang secara terpisah, atau mengubah rute/data V2, YukReview V3, WiV1.

## Alur akhir
- Provider menyiapkan kartu dan PIN di `/admin/cards`.
- QR/NFC berisi URL permanen `https://app.ulasantoko.space/r-v1/ULAS-xxxxx` **hanya setelah rute V1 ada di production**.
- Kartu inactive mengarah ke `/activate?card_code=ULAS-xxxxx` pada host V1 yang sama. PIN digunakan satu kali; input Google Review harus memiliki Place ID eksplisit dan benar.
- Kartu active mengirim HTTP 307 langsung ke Google Review URL tersimpan.
- Kartu missing/URL invalid/database error harus gagal tertutup, tidak memilih bisnis pengganti.

## Verifikasi sebelum merge
- [ ] Build, V1 policy test, dan Vercel Preview Ready pada commit yang sama.
- [ ] Preview dummy TIDAK dapat mengakses Supabase Production; jangan membuat/aktivasi kartu di Preview.
- [ ] Uji URL aktif dan inactive melalui lingkungan terisolasi atau rencana rollout production yang terkontrol (tanpa langsung mengubah QR/NFC pelanggan lama).
- [ ] Pastikan production main masih memuat aplikasi legacy V1 dan juga kode V2 dalam repo yang sama: perubahan V1 tidak mengubah perilaku V2.
- [ ] Ambil backup data kartu V1 sebelum rilis; siapkan rollback deployment Vercel.
- [ ] Cek doman app.ulasantoko.space terikat ke deployment yang benar dan sertifikat SSL valid.
- [ ] Cek 404 URL /r-v1/... hilang setelah release.
- [ ] Uji kartu inactive ULAS-00201 tanpa mengaktivasi sampai siap; statusnya harus tetap inactive.
- [ ] Uji kartu active ULAS-00171 BEARD mengarah ke identitas bisnis Google benar.
- [ ] Audit QR fisik, NFC Tools read, dan Short.io mapping; jangan mengganti massal tanpa bukti.
- [ ] Uji Android NFC, iPhone NFC, QR camera, tautan HTTPS dan Google login.
- [ ] Cek keamanan admin key dan percobaan PIN salah berulang (rate limiting diperlukan sebelum skala massal).
- [ ] Lakukan batch pilot kartu terbatas, lalu produksi komersial.

## Keputusan pemasaran
Jangan mencetak URL Preview/dummy; cetak QR dan tulis NFC hanya menggunakan URL rute production yang berhasil diuji.
