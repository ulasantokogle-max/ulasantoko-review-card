"use client";

import { useState } from "react";

export default function CreateCardPage() {
  const [adminKey, setAdminKey] = useState("");
  const [cardCode, setCardCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    card_code: string;
    activation_pin: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function createCard(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/cards/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          admin_key: adminKey,
          card_code: cardCode,
        }),
      });

      const data = await response.json();

if (!response.ok) {
  throw new Error(
    data.message || "Kartu gagal dibuat."
  );
}

setResult({
  card_code: data.card_code,
  activation_pin: data.activation_pin,
});

setCardCode("");

      setCardCode("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-200 p-7">

        <div className="mb-7">
          <p className="text-sm font-semibold text-gray-500">
            ULASANTOKO
          </p>

          <h1 className="text-2xl font-bold mt-1">
            Create Card
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            Buat kartu baru dan generate PIN aktivasi.
          </p>
        </div>

        <form onSubmit={createCard} className="space-y-5">

          <div>
            <label className="block text-sm font-semibold mb-2">
              Admin Key
            </label>

            <input
              type="password"
              value={adminKey}
              onChange={(e) =>
                setAdminKey(e.target.value)
              }
              placeholder="Masukkan admin key"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-black"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Kode Kartu
            </label>

            <input
              type="text"
              value={cardCode}
              onChange={(e) =>
                setCardCode(e.target.value.toUpperCase())
              }
              placeholder="Contoh: ULAS-00126"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-black"
              required
            />

            <p className="text-xs text-gray-500 mt-2">
              Format: ULAS-00125
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded-xl py-3 font-semibold disabled:opacity-50"
          >
            {loading
              ? "Membuat kartu..."
              : "Create Card"}
          </button>

        </form>

        {error && (
          <div className="mt-5 bg-red-50 text-red-600 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-5">

            <p className="text-sm font-semibold text-green-700 mb-4">
              ✓ Kartu berhasil dibuat
            </p>

            <div className="space-y-3">

              <div>
                <p className="text-xs text-gray-500">
                  Kode Kartu
                </p>

                <p className="text-xl font-bold">
                  {result.card_code}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  PIN Aktivasi
                </p>

                <p className="text-3xl font-bold tracking-[0.3em]">
                  {result.activation_pin}
                </p>
              </div>

            </div>

            <div className="mt-5 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
              Simpan PIN ini. PIN asli tidak disimpan
              di database dan sebaiknya langsung dicetak
              pada kartu fisik.
            </div>

          </div>
        )}

      </section>
    </main>
  );
}
