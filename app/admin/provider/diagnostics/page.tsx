"use client";

import { useCallback, useEffect, useState } from "react";

type Check = { ok: boolean; label: string; detail: string };
type Readiness = {
  mode: string;
  ready: boolean;
  reason: string;
  cardCount?: number | null;
  checks?: Check[];
};

export default function V1ProviderDiagnostics() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const sessionResponse = await fetch("/api/v1/provider/session", { cache: "no-store" });
      const session = await sessionResponse.json();
      const verified = sessionResponse.ok && session.authenticated === true;
      setAuthenticated(verified);
      if (!verified) return;
      const response = await fetch("/api/v1/provider/status", { cache: "no-store" });
      const result = await response.json();
      setStatus(result as Readiness);
    } catch {
      setStatus({ mode: "unknown", ready: false, reason: "Pemeriksaan sistem V1 gagal. Coba lagi." });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return <main className="min-h-screen bg-gray-50 px-4 py-10">
    <section className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-bold text-blue-700">ULASANTOKO V1 · PROVIDER</p>
      <h1 className="mt-2 text-2xl font-bold">Kesiapan Sistem V1</h1>
      <p className="mt-2 text-sm text-gray-600">
        Pemeriksaan aman tanpa mengubah database, kode kartu, QR, NFC, atau sistem lain.
      </p>

      {loading && <p className="mt-5 text-sm">Memeriksa kesiapan database V1...</p>}
      {!loading && !authenticated &&
        <p className="mt-5 rounded-xl bg-gray-100 p-4 text-sm">
          Silakan <a href="/admin/provider" className="text-blue-700 underline">masuk Provider V1</a> terlebih dahulu.
        </p>}
      {!loading && authenticated && status && <>
        <div role="status" className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="font-semibold">{status.ready ? "Sistem siap menerbitkan kartu" : "Penerbitan kartu belum siap"}</p>
          <p className="mt-2 text-sm text-gray-700">{status.reason}</p>
          {typeof status.cardCount === "number" && <p className="mt-2 text-sm">
            Jumlah kartu di database V1 khusus: <strong>{status.cardCount}</strong>
          </p>}
        </div>
        <div className="mt-5 space-y-3">
          {(status.checks || []).map(c =>
            <div key={c.label} className="rounded-xl border border-gray-200 p-4">
              <p className="font-semibold">{c.ok ? "✓" : "•"} {c.label}</p>
              <p className="mt-1 text-sm text-gray-600">{c.detail}</p>
            </div>)}
        </div>
        {!status.ready && <section className="mt-6">
          <h2 className="font-semibold">Langkah penyelesaian</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-sm text-gray-700">
            <li>Pulihkan dan audit kartu Supabase V1 lama. Proyek lama masih memerlukan akses pemilik organisasi.</li>
            <li>Pasang <code>V1_SUPABASE_URL</code> dan <code>V1_SUPABASE_SERVICE_ROLE_KEY</code> hanya pada hosting proyek V1. Jangan ubah environment V2/V3/WiV1.</li>
            <li>Verifikasi jumlah kartu, tujuan Google Review, PIN hash, dan kode unik sebelum menyetujui migration gate.</li>
          </ol>
          <p className="mt-4 text-xs text-gray-500">Jangan kirim API key atau PIN ke chat ataupun GitHub.</p>
        </section>}
      </>}
      <nav className="mt-7 flex flex-wrap gap-4 text-sm text-blue-700">
        <a href="/admin/provider" className="underline">Kembali ke Provider</a>
        <a href="/admin/provider/bulk-create" className="underline">Bulk Create</a>
        <button type="button" className="underline disabled:opacity-50" onClick={() => void refresh()} disabled={loading}>Periksa ulang</button>
      </nav>
    </section>
  </main>;
}
