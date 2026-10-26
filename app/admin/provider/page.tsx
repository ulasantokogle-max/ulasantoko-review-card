"use client";
import { useEffect, useState } from "react";

type Card = { card_code: string; status: string; business_name: string | null };
const urlFor = (code: string) => "https://app.ulasantoko.space/r-v1/" + encodeURIComponent(code);

export default function ProviderToolsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminKey, setAdminKey] = useState("");
  const [code, setCode] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/provider/session", { cache: "no-store" })
      .then(r => r.json()).then(d => setAuthenticated(d.authenticated === true))
      .catch(() => setAuthenticated(false)).finally(() => setChecking(false));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/v1/provider/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_key: adminKey }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Login gagal.");
      setAdminKey(""); setAuthenticated(true);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Login gagal."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/v1/provider/session", { method: "DELETE" });
    setAuthenticated(false); setCard(null); setAdminKey(""); setMessage("");
  }

  async function findCard(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setCard(null); setMessage("");
    try {
      const r = await fetch("/api/v1/provider/cards?card_code=" + encodeURIComponent(code.trim().toUpperCase()), { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Kartu gagal dicari.");
      setCard(d.card);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Pencarian gagal."); }
    finally { setBusy(false); }
  }

  async function downloadQr() {
    if (!card) return;
    try {
      const QRCode = await import("qrcode");
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, urlFor(card.card_code), { errorCorrectionLevel: "H", width: 1200, margin: 4 });
      const a = document.createElement("a");
      a.download = "QR-" + card.card_code + ".png";
      a.href = canvas.toDataURL("image/png"); a.click();
      setMessage("QR berhasil diunduh. Scan ulang sebelum mencetak.");
    } catch { setMessage("Gagal membuat QR."); }
  }

  async function writeNfc() {
    if (!card || busy) return;
    const NFC = (window as Window & { NDEFReader?: new () => {
      write(data: { records: {recordType: string; data: string}[] }): Promise<void>;
    } }).NDEFReader;
    if (!NFC) { setMessage("Web NFC memerlukan Chrome Android. Gunakan tombol Salin URL dengan NFC Tools."); return; }
    setBusy(true); setMessage("Dekatkan tag NFC yang dapat ditulis ke HP.");
    try {
      await new NFC().write({ records: [{ recordType: "url", data: urlFor(card.card_code) }] });
      setMessage("NFC berhasil ditulis. Scan kembali untuk verifikasi.");
    } catch (e) {
      setMessage(e instanceof Error ? "NFC gagal: " + e.message : "NFC gagal.");
    } finally { setBusy(false); }
  }

  async function copyUrl() {
    if (!card) return;
    try { await navigator.clipboard.writeText(urlFor(card.card_code)); setMessage("URL NFC berhasil disalin."); }
    catch { setMessage("Salin URL yang tercantum secara manual."); }
  }

  return <main className="min-h-screen bg-gray-50 px-4 py-12">
    <section className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">ULASANTOKO V1</p>
      <h1 className="mt-2 text-2xl font-bold">Provider • Kelola Kartu</h1>
      <p className="mt-2 text-sm text-gray-600">Download ulang QR dan rewrite NFC tanpa membuat kartu baru.</p>
      {checking ? <p className="mt-6">Memeriksa sesi...</p> : !authenticated ?
        <form onSubmit={login} className="mt-6 space-y-3">
          <label className="block text-sm font-semibold">Admin Key Provider</label>
          <input required type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)}
            className="w-full rounded-xl border p-3" autoComplete="off" />
          <button disabled={busy} className="w-full rounded-xl bg-black p-3 font-semibold text-white">Masuk Provider</button>
        </form> :
        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between">
            <a className="text-sm text-blue-700 underline" href="/admin/cards">Buat kartu baru</a>
            <button type="button" className="text-sm underline" onClick={logout}>Keluar</button>
          </div>
          <form onSubmit={findCard} className="space-y-3">
            <label className="block text-sm font-semibold">Cari kode kartu</label>
            <input required value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ULAS-00204" className="w-full rounded-xl border p-3" />
            <button disabled={busy} className="w-full rounded-xl bg-black p-3 font-semibold text-white">Cari Kartu</button>
          </form>
          {card && <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-bold">{card.card_code}</p>
            <p className="text-sm">{card.business_name || "Belum diaktivasi"} • {card.status}</p>
            <p className="break-all text-xs">{urlFor(card.card_code)}</p>
            <button onClick={downloadQr} className="w-full rounded-xl bg-black p-3 font-semibold text-white">Download Ulang QR</button>
            <button onClick={writeNfc} disabled={busy} className="w-full rounded-xl bg-blue-700 p-3 font-semibold text-white">Rewrite NFC</button>
            <button onClick={copyUrl} className="w-full rounded-xl border bg-white p-3 font-semibold">Salin URL NFC</button>
            <p className="text-xs text-gray-600">Rewrite NFC menimpa record tag writable, bukan mengubah tujuan kartu di database. Tag terkunci tidak bisa ditulis ulang.</p>
          </div>}
        </div>}
      {message && <p role="status" className="mt-5 rounded-xl bg-gray-100 p-3 text-sm">{message}</p>}
    </section>
  </main>;
}
