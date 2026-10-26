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
  const [toolMessage, setToolMessage] = useState("");
  const [writing, setWriting] = useState(false);
  const cardUrl = (code: string) => "https://app.ulasantoko.space/r-v1/" + encodeURIComponent(code);

  async function downloadQr() {
    if (!result) return;
    try {
      const QRCode = await import("qrcode");
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, cardUrl(result.card_code), {
        errorCorrectionLevel: "H", width: 1200, margin: 4,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.download = "QR-" + result.card_code + ".png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      setToolMessage("QR PNG berhasil dibuat. Scan QR sebelum dicetak.");
    } catch {
      setToolMessage("Gagal membuat QR. Coba lagi.");
    }
  }

  async function writeNfc() {
    if (!result || writing) return;
    const NFCReader = (window as Window & {
      NDEFReader?: new () => { write(message: {records: {recordType: string; data: string}[]}): Promise<void> };
    }).NDEFReader;
    if (!NFCReader) {
      setToolMessage("Web NFC tidak tersedia. Gunakan Chrome di Android dengan NFC aktif, atau salin URL ke aplikasi NFC Tools.");
      return;
    }
    setWriting(true);
    try {
      setToolMessage("Dekatkan tag NFC ke HP Android.");
      const writer = new NFCReader();
      await writer.write({records: [{recordType: "url", data: cardUrl(result.card_code)}]});
      setToolMessage("NFC berhasil ditulis. Uji baca kembali URL.");
    } catch (err) {
      setToolMessage(err instanceof Error ? "NFC gagal: " + err.message : "NFC gagal ditulis.");
    } finally {
      setWriting(false);
    }
  }

  async function copyNfcUrl() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(cardUrl(result.card_code));
      setToolMessage("URL tersalin. Pakai record URL/URI pada NFC Tools.");
    } catch {
      setToolMessage("Tidak dapat menyalin otomatis. Salin URL yang ditampilkan.");
    }
  }


  async function createCard(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);
    setToolMessage("");

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

          <a href="/admin/provider" className="text-sm text-blue-700 underline">Login Provider / Kelola QR & NFC lama</a>
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


            <div className="mt-5 space-y-3 border-t border-green-200 pt-4">
              <p className="text-xs font-semibold text-gray-700">URL permanen QR & NFC</p>
              <p className="break-all text-xs text-gray-700">{cardUrl(result.card_code)}</p>
              <button type="button" onClick={downloadQr}
                className="w-full bg-black text-white rounded-xl py-3 font-semibold">
                Download QR (PNG)
              </button>
              <button type="button" onClick={writeNfc} disabled={writing}
                className="w-full bg-blue-700 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
                {writing ? "Menunggu NFC..." : "Tulis NFC"}
              </button>
              <button type="button" onClick={copyNfcUrl}
                className="w-full bg-white border border-gray-300 rounded-xl py-3 font-semibold">
                Salin URL NFC
              </button>
              <p className="text-xs text-gray-600">Penulisan NFC langsung didukung Chrome Android dengan NFC aktif dan tag writable. Pada komputer/iPhone, salin URL ke aplikasi NFC Tools.</p>
              {toolMessage && <p role="status" className="rounded-xl bg-white p-3 text-xs">{toolMessage}</p>}
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
