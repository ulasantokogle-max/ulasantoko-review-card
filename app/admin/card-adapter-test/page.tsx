"use client";

import { useState } from "react";
import { getCardAdapter } from "@/lib/card-adapter";

export default function CardAdapterTestPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleTest() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const adapter = await getCardAdapter(code.trim());

      if (!adapter) {
        setError("Card tidak ditemukan atau tidak aktif.");
        return;
      }

      setResult(adapter);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat membaca Card Adapter."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Card Adapter V2 Test
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Testing layer Card Adapter tanpa mengubah sistem existing.
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">
            Card Code
          </label>

          <div className="mt-2 flex gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Contoh: ABC123"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-gray-500"
            />

            <button
              onClick={handleTest}
              disabled={loading || !code.trim()}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Testing..." : "Test Adapter"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result !== null && (
          <div className="mt-5 rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-3">
              <h2 className="font-semibold text-gray-900">
                Adapter Result
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Data yang dikembalikan oleh Card Adapter V2.
              </p>
            </div>

            <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-sm text-green-400">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
