# V1 — Direct Google Review: QA sebelum produksi

Branch: `feature/v1-direct-review-redirect-20261025`  
PR: #3 (draft)  
Rute baru: `/r-v1/ULAS-12345`

## Batas perubahan
- Hanya rute V1 yang baru; tidak mengubah `/[cardCode]` (landing V2) atau `/card/[cardCode]` (legacy).
- Tidak mengubah schema/data Supabase, QR yang sudah dicetak, NFC yang sudah direkam, ataupun Short.io.
- YukReview V3 dan WiV1 berada di project terpisah.

## Matriks QA
| Kondisi | Hasil diharapkan |
| --- | --- |
| Kode kosong/format salah | 400, tidak redirect |
| Kode kartu tidak ditemukan | 404, tidak redirect |
| Kartu inactive | 404, tidak redirect |
| Kartu active + Google Review URL valid | 307 dengan Location = URL Google, tanpa landing |
| Kartu active + URL kosong | 422 |
| Kartu active + URL non-Google/http/userinfo | 422 |
| Kartu active + Google Maps bukan composer review | 422 |
| Supabase error | 503 |
| Kartu active + tombol V2 lama | Perilaku V2 tidak berubah |
| QR/NFC fisik lama | Tidak diubah sampai mapping diketahui |

## Checklist sebelum pengalihan kartu fisik
- [ ] Pastikan commit PR #3 lolos TypeScript & Next build di GitHub Actions.
- [ ] Dapatkan alamat preview milik deployment V1 dari Vercel; **jangan** gunakan preview repo V3.
- [ ] Jalankan QA dengan kartu aktif dummy yang URL-nya berasal dari Google Business Profile yang benar.
- [ ] Scan QR dan tap NFC fisik sampel; catat URL yang terbuka saat ini.
- [ ] Jika menggunakan Short.io, cek target tiap short URL sebelum perubahan.
- [ ] Pilih strategi migrasi URL secara eksplisit; kartu tercetak yang menunjuk URL tetap tidak otomatis pindah.
- [ ] Cek tidak ada perubahan pada rute V2, V3, dan kartu aktif lainnya.
- [ ] Baru merge/deploy setelah semua poin di atas diterima.

## Kebijakan data
Tidak melakukan auto-pick bisnis dari hasil Google Places berdasarkan nama saja.
Aktivasi harus memvalidasi Place ID terhadap bisnis yang benar.
Tautan ke composer Google Review harus HTTPS dan tidak dapat berasal dari domain lain.
