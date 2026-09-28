"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = { cardCode: string };

export default function V2CardTools({ cardCode }: Props) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [nfcMessage, setNfcMessage] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const code = cardCode.trim().toUpperCase();
  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "/" + code;
    return window.location.origin + "/" + encodeURIComponent(code);
  }, [code]);

  async function unlock() {
    setLoading(true);
    setNfcMessage("");
    try {
      const res = await fetch("/api/v2/store-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", card_code: code, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "PIN tidak valid.");
      setBusinessName(data.business?.business_name || code);
      setLogoUrl(data.business?.logo_url || "");
      setUnlocked(true);
    } catch (e) {
      setNfcMessage(e instanceof Error ? e.message : "Tidak dapat membuka alat QR/NFC.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;

    (async () => {
      const dataUrl = await QRCode.toDataURL(publicUrl, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 900,
      });
      if (!cancelled) setQrDataUrl(dataUrl);

      const canvas = canvasRef.current;
      if (canvas) {
        await QRCode.toCanvas(canvas, publicUrl, {
          errorCorrectionLevel: "H",
          margin: 2,
          width: 900,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [unlocked, publicUrl]);

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = code + "-QR.png";
    a.click();
  }

  async function writeNfc() {
    setNfcMessage("");
    const NDEF = (window as typeof window & { NDEFReader?: new () => { write: (message: unknown) => Promise<void> } }).NDEFReader;
    if (!NDEF) {
      setNfcMessage("Web NFC belum didukung di browser/perangkat ini. Gunakan Chrome di Android dengan NFC aktif.");
      return;
    }

    try {
      const ndef = new NDEF();
      await ndef.write({
        records: [{ recordType: "url", data: publicUrl }],
      });
      setNfcMessage("✓ Link V2 berhasil ditulis ke NFC.");
    } catch (e) {
      setNfcMessage(e instanceof Error ? e.message : "NFC gagal ditulis.");
    }
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-[#f4f5f3] px-4 py-8">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-7 shadow-sm">
          <p className="text-xs font-bold tracking-[.22em] text-[#9a6a35]">ULASAN TOKO V2</p>
          <h1 className="mt-2 text-2xl font-bold">QR & NFC Card</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Buat QR dan tulis NFC yang selalu mengarah ke landing page berdasarkan kode kartu.
          </p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Kode Kartu</p>
            <p className="mt-1 text-lg font-bold">{code}</p>
          </div>
          <label className="mt-5 block">
            <span className="text-sm font-semibold">PIN Aktivasi</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              type="password"
              inputMode="numeric"
              maxLength={6}
              className="mt-2 w-full rounded-2xl border px-4 py-3 tracking-[.35em] outline-none"
            />
          </label>
          {nfcMessage && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{nfcMessage}</p>}
          <button
            type="button"
            onClick={unlock}
            disabled={loading || pin.length !== 6}
            className="mt-5 w-full rounded-2xl bg-[#142721] px-5 py-4 font-bold text-white disabled:opacity-50"
          >
            {loading ? "Memeriksa..." : "Buka QR & NFC"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5f3] px-4 py-6 sm:py-10">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-xs font-bold tracking-[.22em] text-[#9a6a35]">ULASAN TOKO V2</p>
            <h1 className="mt-1 text-2xl font-bold">QR & NFC Card</h1>
            <p className="mt-1 text-sm text-slate-500">{businessName} · {code}</p>
          </div>
          <a href={"/" + code} className="rounded-xl border px-3 py-2 text-xs font-semibold">Lihat Landing</a>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_260px]">
          <div>
            <h2 className="text-base font-bold">Link Card</h2>
            <p className="mt-1 text-sm text-slate-500">URL inilah yang dipakai bersama oleh QR dan NFC.</p>
            <div className="mt-3 break-all rounded-2xl bg-slate-50 p-4 text-sm font-semibold">{publicUrl}</div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={downloadQr} disabled={!qrDataUrl} className="rounded-2xl bg-[#142721] px-5 py-4 font-bold text-white disabled:opacity-50">
                Download QR PNG
              </button>
              <button type="button" onClick={writeNfc} className="rounded-2xl border border-[#142721] bg-white px-5 py-4 font-bold text-[#142721]">
                Tulis ke NFC
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              QR dan NFC menyimpan URL card, bukan URL Google Review. Jadi URL Google Review bisa diganti dari Pengaturan Toko tanpa mencetak ulang QR atau menulis ulang NFC.
            </div>

            {nfcMessage && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{nfcMessage}</div>}
          </div>

          <div className="rounded-3xl border bg-slate-50 p-4">
            <p className="mb-3 text-center text-xs font-bold tracking-[.18em] text-slate-500">QR PREVIEW</p>
            <div className="rounded-2xl bg-white p-3">
              <canvas ref={canvasRef} className="h-auto w-full" />
            </div>
            {logoUrl && (
              <div className="mt-4 flex justify-center">
                <img src={logoUrl} alt="Logo toko" className="h-14 w-14 rounded-xl object-contain bg-white p-1" />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
