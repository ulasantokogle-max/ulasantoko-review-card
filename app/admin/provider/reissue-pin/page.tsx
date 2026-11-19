"use client";
import { useEffect, useState } from "react";

type Card = { card_code: string; status: string; business_name: string | null };

export default function ReissuePinPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/provider/session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => setAuthenticated(data?.authenticated === true))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  async function findCard(e: React.FormEvent) {
    e.preventDefault();
    setCard(null); setNewPin(""); setConfirmCode(""); setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/v1/provider/cards?card_code=" + encodeURIComponent(code.trim().toUpperCase()), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Kartu tidak ditemukan.");
      setCard(data.card);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pencarian gagal.");
    } finally { setBusy(false); }
  }

  async function reissue(e: React.FormEvent) {
    e.preventDefault();
    if (!card || card.status !== "inactive" || confirmCode.trim().toUpperCase() !== card.card_code) return;
    setBusy(true); setNewPin(""); setMessage("");
    try {
      const response = await fetch("/api/v1/provider/reissue-pin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_code: card.card_code, confirm_card_code: confirmCode.trim().toUpperCase() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Gagal menerbitkan PIN.");
      setNewPin(data.activation_pin);
      setMessage("PIN lama sudah tidak berlaku. Simpan PIN baru sekarang; hanya ditampilkan satu kali.");
      setConfirmCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10">
    <section className="mx-auto max-w-xl rounded-3xl border bg-white p-6 shadow-sm">
      <p className="text-xs font-bold text-blue-700">PROVIDER V1 · PEMULIHAN TERBATAS</p>
      <h1 className="mt-2 text-2xl font-bold">Terbitkan PIN Aktivasi Baru</h1>
      <p className="mt-3 text-sm text-slate-600">Hanya untuk kartu V1 yang belum aktif. PIN asli tidak dapat ditampilkan kembali. Menerbitkan PIN baru akan membatalkan PIN sebelumnya dan tidak mengubah tujuan QR/NFC.</p>
      <a className="mt-3 inline-block text-blue-700 underline" href="/admin/provider">Kembali ke Provider V1</a>
      {checking ? <p className="mt-5">Memeriksa sesi...</p> : !authenticated ?
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm">Login di Provider V1 terlebih dahulu.</p> :
        <>
          <form onSubmit={findCard} className="mt-6 space-y-3">
            <label className="block text-sm font-semibold">Kode kartu</label>
            <input required value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setCard(null); setNewPin(""); }}
              placeholder="ULAS-00206" className="w-full rounded-xl border p-3" />
            <button disabled={busy} className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50">Cari kartu</button>
          </form>
          {card && <div className="mt-6 space-y-4 rounded-2xl border border-blue-200 p-4">
            <p><strong>{card.card_code}</strong> · {card.status} · {card.business_name || "Belum diaktivasi"}</p>
            {card.status !== "inactive" ? <p className="text-sm text-red-700">PIN kartu aktif tidak boleh diganti lewat halaman ini.</p> :
            <form onSubmit={reissue} className="space-y-3">
              <p className="text-sm font-medium text-red-700">Peringatan: tindakan ini membatalkan PIN lama. Pastikan kartu fisik yang benar dan catat PIN pengganti.</p>
              <label className="block text-sm font-semibold">Ketik ulang kode kartu untuk konfirmasi</label>
              <input value={confirmCode} required onChange={e => setConfirmCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border p-3" autoComplete="off" placeholder={card.card_code} />
              <button disabled={busy || confirmCode.trim().toUpperCase() !== card.card_code}
                className="w-full rounded-xl bg-red-700 p-3 font-semibold text-white disabled:opacity-50">
                {busy ? "Memproses..." : "Terbitkan PIN Baru dan Batalkan PIN Lama"}
              </button>
            </form>}
          </div>}
          {newPin && <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5" role="status">
            <p className="text-sm font-bold">PIN AKTIVASI BARU — SIMPAN SEKARANG</p>
            <p className="mt-2 select-all font-mono text-3xl font-bold tracking-widest">{newPin}</p>
            <p className="mt-2 text-xs">Jangan bagikan PIN di chat atau screenshot publik. PIN hanya ditampilkan satu kali.</p>
          </div>}
        </>}
      {message && <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4 text-sm">{message}</p>}
    </section>
  </main>;
}
