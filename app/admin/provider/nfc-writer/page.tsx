"use client";

import { useEffect, useState } from "react";

type Card = { card_code: string; status: string; business_name: string | null };
type NdefWriter = { write(message: { records: { recordType: string; data: string }[] }): Promise<void> };
type NdefReaderCtor = new () => NdefWriter;
const v1Url = (cardCode: string) => "https://app.ulasantoko.space/r-v1/" + encodeURIComponent(cardCode);

export default function V1ProviderNfcWriterPage() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmWrite, setConfirmWrite] = useState(false);

  useEffect(() => {
    fetch("/api/v1/provider/session", { cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(session => setAuthenticated(session?.authenticated === true))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  async function findCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    setCard(null);
    setConfirmWrite(false);
    setMessage("");
    if (!/^ULAS-\d{4,}$/.test(normalized)) {
      setMessage("Kode kartu harus memakai format ULAS-xxxx (minimal 4 digit).");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/v1/provider/cards?card_code=" + encodeURIComponent(normalized), { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { setAuthenticated(false); throw new Error("Sesi Provider berakhir. Login ulang."); }
      if (!response.ok) throw new Error(data.message || "Kartu tidak ditemukan.");
      if (data.card?.card_code !== normalized) throw new Error("Kode kartu hasil pencarian tidak sesuai.");
      setCard(data.card);
      setCode(normalized);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pencarian gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function writeNfc() {
    if (!card || !confirmWrite || writing) return;
    const NDEFReader = (window as Window & { NDEFReader?: NdefReaderCtor }).NDEFReader;
    if (!window.isSecureContext || !NDEFReader) {
      setMessage("Tulis NFC melalui Chrome di HP Android dengan NFC aktif dan HTTPS. Di perangkat lain, pilih Salin URL untuk NFC Tools.");
      return;
    }
    setWriting(true);
    setMessage("Dekatkan satu tag NFC yang dapat ditulis ke belakang HP. Jangan pindahkan sampai selesai.");
    try {
      await new NDEFReader().write({ records: [{ recordType: "url", data: v1Url(card.card_code) }] });
      setMessage("NFC berhasil ditulis untuk " + card.card_code + ". Scan ulang dengan HP untuk memastikan URL benar.");
      setConfirmWrite(false);
    } catch (error) {
      setMessage("Penulisan NFC gagal: " + (error instanceof Error ? error.message : "Periksa izin, posisi tag, atau status lock tag."));
    } finally {
      setWriting(false);
    }
  }

  async function copyUrl() {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(v1Url(card.card_code));
      setMessage("URL V1 tersalin. Di NFC Tools pilih Write > Add a record > URL/URI, tempel URL lalu Write.");
    } catch {
      setMessage("Penyalinan otomatis gagal. Pilih dan salin URL yang tampil di bawah.");
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">YukReview · Provider V1</p>
        <h1 className="mt-2 text-3xl font-bold">Tulis NFC Kartu</h1>
        <p className="mt-2 text-sm text-slate-600">Tulis atau rewrite tag NFC menggunakan URL permanen kartu V1. Sistem V3 dan layanan lainnya tidak terhubung dengan fitur ini.</p>
        <a href="/admin/provider" className="mt-4 inline-block text-sm font-semibold text-blue-700 underline">← Kembali ke Provider V1</a>
      </header>
      {checking ? <section className="rounded-2xl bg-white p-6">Memeriksa sesi Provider...</section> :
        !authenticated ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm">
          Sesi Provider V1 belum aktif. <a className="font-semibold text-blue-700 underline" href="/admin/provider">Login melalui Provider V1</a> terlebih dahulu.
        </section> :
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold">1. Pilih kartu V1</h2>
            <form onSubmit={findCard} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input aria-label="Kode kartu V1" required value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setCard(null); setConfirmWrite(false); }} placeholder="ULAS-00204" className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3 uppercase" />
              <button type="submit" disabled={loading || writing} className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white disabled:opacity-50">{loading ? "Mencari..." : "Cari Kartu"}</button>
            </form>
          </section>
          {card && <section className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold">2. Periksa tujuan NFC</h2>
            <div className="mt-4 rounded-2xl bg-blue-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-lg">{card.card_code}</strong>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{card.status}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{card.business_name || "Belum diaktivasi"}</p>
              <p className="mt-4 text-xs font-semibold text-slate-500">URL PERMANEN V1</p>
              <p className="mt-1 select-all break-all font-mono text-sm">{v1Url(card.card_code)}</p>
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm">
              <input type="checkbox" checked={confirmWrite} onChange={event => setConfirmWrite(event.target.checked)} className="mt-1 h-4 w-4" />
              <span>Saya sudah memeriksa kode kartu dan memahami bahwa penulisan ulang akan mengganti isi tag NFC fisik yang dapat ditulis.</span>
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={writeNfc} disabled={!confirmWrite || writing || loading} className="rounded-xl bg-blue-700 p-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{writing ? "Tempelkan tag NFC..." : "Tulis / Rewrite NFC"}</button>
              <button type="button" onClick={copyUrl} disabled={writing} className="rounded-xl border border-blue-200 bg-white p-4 font-bold text-blue-800">Salin URL untuk NFC Tools</button>
            </div>
          </section>}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            <h2 className="font-bold text-slate-900">3. Verifikasi kartu fisik</h2>
            <p className="mt-2">Gunakan Chrome Android, aktifkan NFC, lalu izinkan akses NFC ketika diminta. Setelah selesai, jauhkan tag dan scan ulang. Pastikan URL yang terbaca sama dengan URL V1 di atas.</p>
            <p className="mt-3">Web NFC tidak tersedia di sebagian browser dan komputer. Pada perangkat tersebut gunakan NFC Tools. Tag yang dikunci permanen tidak dapat di-rewrite.</p>
            <p className="mt-3">Fitur ini tidak membuat kartu baru, mengubah PIN, mengganti tujuan ulasan, atau menyentuh database V3/WiV1.</p>
          </section>
        </>}
      {message && <p role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">{message}</p>}
    </div>
  </main>;
}
