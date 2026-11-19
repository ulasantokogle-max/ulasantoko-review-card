"use client";

import { useCallback, useEffect, useState } from "react";

type Check = { ok: boolean; label: string; detail: string };
type MapsResult = {
  status: "direct" | "resolved" | "confirm" | "unresolved";
  message: string;
  review_url?: string;
  candidate?: { name: string; address: string; verified: boolean };
};
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
  const [mapsUrl, setMapsUrl] = useState("https://maps.app.goo.gl/9QxANuCdbfTxQnr66");
  const [mapsBusinessName, setMapsBusinessName] = useState("MJH (Media Jump Start Hub) Digital Solution");
  const [mapsBusy, setMapsBusy] = useState(false);
  const [mapsResult, setMapsResult] = useState<MapsResult | null>(null);
  const [mapsError, setMapsError] = useState("");


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
  async function checkMaps(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMapsBusy(true);
    setMapsResult(null);
    setMapsError("");
    try {
      const response = await fetch("/api/v1/provider/maps-check", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        cache:"no-store",
        body:JSON.stringify({maps_url:mapsUrl.trim(),business_name:mapsBusinessName.trim()}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Pemeriksaan gagal.");
      setMapsResult(data as MapsResult);
    } catch(error) {
      setMapsError(error instanceof Error ? error.message : "Pemeriksaan gagal.");
    } finally {
      setMapsBusy(false);
    }
  }


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
        <section className="mt-7 rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
          <h2 className="font-bold text-gray-900">Uji link Google Maps → Review V1</h2>
          <p className="mt-2 text-sm text-gray-600">Pemeriksaan langsung Google Places tanpa aktivasi kartu, tanpa PIN dan tanpa perubahan database kartu. Gunakan sebelum melakukan aktivasi.</p>
          <form onSubmit={checkMaps} className="mt-4 space-y-3">
            <label className="block text-sm font-semibold">Nama bisnis
              <input value={mapsBusinessName} required onChange={e => {setMapsBusinessName(e.target.value);setMapsResult(null);}} maxLength={180} className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 font-normal" />
            </label>
            <label className="block text-sm font-semibold">Link berbagi Google Maps
              <input type="url" required value={mapsUrl} onChange={e => {setMapsUrl(e.target.value);setMapsResult(null);}} className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 font-normal" />
            </label>
            <button disabled={mapsBusy} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{mapsBusy ? "Memeriksa Google Places..." : "Periksa Tanpa Aktivasi"}</button>
          </form>
          {mapsError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{mapsError}</p>}
          {mapsResult && <div role="status" className="mt-4 space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm">
            <p className="font-bold">{mapsResult.status === "unresolved" ? "Belum ditemukan" : mapsResult.status === "confirm" ? "Butuh konfirmasi" : "Tautan ulasan ditemukan"}</p>
            <p>{mapsResult.message}</p>
            {mapsResult.candidate && <div className="rounded-lg bg-gray-50 p-3">
              <p className="font-semibold">{mapsResult.candidate.name}</p>
              <p>{mapsResult.candidate.address}</p>
            </div>}
            {mapsResult.review_url && <div className="space-y-1">
              <p className="font-semibold">URL Tulis Ulasan (pratinjau)</p>
              <a href={mapsResult.review_url} target="_blank" rel="noopener noreferrer" className="block break-all text-blue-700 underline">{mapsResult.review_url}</a>
              <p className="text-xs text-gray-500">Pastikan Google menampilkan bisnis yang sesuai. Pemeriksaan ini belum mengaktifkan kartu apa pun.</p>
            </div>}
          </div>}
        </section>
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
