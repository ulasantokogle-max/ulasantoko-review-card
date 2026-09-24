# UlasanToko Review Card

Starter app untuk aktivasi kartu Google Review.

Stack: Next.js + TypeScript + Tailwind + Supabase + Vercel.

Short.io tetap digunakan untuk `ulasantoko.space`, QR, dan NFC. Aplikasi ini fokus pada database dan aktivasi Google Review.

## Setup
1. Buat Supabase project.
2. Jalankan `supabase/schema.sql`.
3. Copy `.env.example` menjadi `.env.local`.
4. Isi environment variables.
5. `npm install`
6. `npm run dev`

## Flow
Short.io `ulasantoko.space/ULAS-001` → aplikasi `/card/ULAS-001` → database → Google Review.

Catatan: untuk produksi, tambahkan autentikasi admin sebelum membuka fitur pengelolaan kartu.