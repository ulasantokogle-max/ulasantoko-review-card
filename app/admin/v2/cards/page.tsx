"use client";

import { useState } from "react";

type Result = {
  card_code: string;
  activation_pin: string;
  public_path: string;
  settings_path: string;
  tools_path: string;
};

export default function V2CreateCardPage() {
  const [adminKey, setAdminKey] = useState("");
  const [cardCode, setCardCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function createCard(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/v2/cards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_key: adminKey,
          card_code: cardCode,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Kartu V2 gagal dibuat.");
      }

      setResult({
        card_code: data.card_code,
        activation_pin: data.activation_pin,
        public_path: data.public_path,
        settings_path: data.settings_path,
        tools_path: data.tools_path,
      });
      setCardCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f5f3] px-4 py-8">
      <section className="mx-auto max-w-xl rounded-3xl border border-black/5 bg-white p-7 shadow-[0_18px_55px_rgba(0,0,0,.08)]">
        <p className="text-xs font-bold tracking-[.22em] text-[#9a6a35]">ULASAN TOKO V2</p>
        <h1 className="mt-2 text-2xl font-bold text-[#182522]">Buat Kartu V2</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Membuat bisnis, kartu, landing page, QR target, dan PIN aktivasi dalam satu proses. Sistem legacy tidak disentuh.
        </p>

        <form onSubmit={createCard} className="mt-7 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold">Admin Key</span>
            <input
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              type="password"
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#173A32]"
              placeholder="Masukkan ADMIN_KEY"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Kode Kartu V2 (opsional)</span>
            <input
              value={cardCode}
              onChange={(e) => setCardCode(e.target.value.toUpperCase())}
              placeholder="Kosongkan untuk otomatis: LP00101"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#173A32]"
            />
            <p className="mt-2 text-xs text-slate-500">Format wajib: LP + 5 digit.</p>
          </label>

          <button
            type="submit"
            disabled={loading || !adminKey}
            className="w-full rounded-2xl bg-[#142721] px-5 py-4 font-bold text-white disabled:opacity-50"
          >
            {loading ? "Membuat kartu..." : "Buat Kartu V2"}
          </button>
        </form>

        {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {result && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-bold text-emerald-800">✓ Kartu V2 berhasil dibuat</p>

            <div className="mt-4 grid gap-4">
              <div>
                <p className="text-xs text-slate-500">Kode Kartu</p>
                <p className="text-2xl font-black tracking-wide">{result.card_code}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500">PIN Aktivasi</p>
                <p className="text-3xl font-black tracking-[.28em]">{result.activation_pin}</p>
              </div>

              <div className="rounded-2xl bg-white p-4 text-xs leading-6 text-slate-600">
                PIN hanya ditampilkan saat kartu dibuat. Simpan PIN ini untuk pemilik toko.
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <a href={result.public_path} className="rounded-xl bg-[#142721] px-4 py-3 text-center text-xs font-bold text-white">
                  Buka Landing
                </a>
                <a href={result.settings_path} className="rounded-xl border border-slate-300 px-4 py-3 text-center text-xs font-bold">
                  Pengaturan
                </a>
                <a href={result.tools_path} className="rounded-xl border border-slate-300 px-4 py-3 text-center text-xs font-bold">
                  QR & NFC
                </a>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
