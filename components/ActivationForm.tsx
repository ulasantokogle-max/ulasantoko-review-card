"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivationForm() {
  const router = useRouter();

  const [cardCode, setCardCode] = useState("");
  const [activationPin, setActivationPin] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const normalizedCardCode = cardCode.trim().toUpperCase();
    const normalizedPin = activationPin.trim();

    // Validasi kode kartu
    if (!/^ULAS-\d{5}$/.test(normalizedCardCode)) {
      setMessage("Format kode kartu tidak valid.");
      setLoading(false);
      return;
    }

    // Validasi PIN
    if (!/^\d{6}$/.test(normalizedPin)) {
      setMessage("PIN aktivasi harus terdiri dari 6 digit.");
      setLoading(false);
      return;
    }

    if (!businessName.trim()) {
      setMessage("Nama bisnis wajib diisi.");
      setLoading(false);
      return;
    }

    if (!reviewUrl.trim()) {
      setMessage("Link Google Review wajib diisi.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/cards/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          card_code: normalizedCardCode,
          activation_pin: normalizedPin,
          business_name: businessName.trim(),
          google_review_url: reviewUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Aktivasi gagal."
        );
      }

      router.push(
        "/card/" + encodeURIComponent(normalizedCardCode)
      );
    } catch (err: any) {
      setMessage(
        err?.message ||
        "Terjadi kesalahan saat aktivasi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-7 space-y-5 rounded-3xl bg-white p-6 shadow-sm border border-gray-100"
    >
      {/* KODE KARTU */}
      <label className="block">
        <span className="text-sm font-semibold">
          Kode Kartu
        </span>

        <input
          required
          value={cardCode}
          onChange={(e) =>
            setCardCode(e.target.value.toUpperCase())
          }
          placeholder="Contoh: ULAS-00125"
          maxLength={10}
          autoComplete="off"
          className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none"
        />
      </label>

      {/* PIN AKTIVASI */}
      <label className="block">
        <span className="text-sm font-semibold">
          PIN Aktivasi
        </span>

        <input
          required
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          value={activationPin}
          onChange={(e) =>
            setActivationPin(
              e.target.value
                .replace(/\D/g, "")
                .slice(0, 6)
            )
          }
          placeholder="Masukkan 6 digit PIN"
          maxLength={6}
          autoComplete="one-time-code"
          className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none tracking-[0.35em]"
        />

        <p className="mt-2 text-xs text-gray-500">
          PIN aktivasi terdapat pada kartu fisik Anda.
        </p>
      </label>

      {/* NAMA BISNIS */}
      <label className="block">
        <span className="text-sm font-semibold">
          Nama Bisnis
        </span>

        <input
          required
          value={businessName}
          onChange={(e) =>
            setBusinessName(e.target.value)
          }
          placeholder="Nama toko / bisnis"
          className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none"
        />
      </label>

      {/* GOOGLE REVIEW */}
      <label className="block">
        <span className="text-sm font-semibold">
          Link Google Review
        </span>

        <input
          required
          type="url"
          value={reviewUrl}
          onChange={(e) =>
            setReviewUrl(e.target.value)
          }
          placeholder="https://maps.app.goo.gl/..."
          className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none"
        />

        <p className="mt-2 text-xs text-gray-500">
          Masukkan link langsung untuk pelanggan
          menulis ulasan di Google.
        </p>
      </label>

      {/* MESSAGE */}
      {message && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      {/* BUTTON */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white disabled:opacity-50"
      >
        {loading
          ? "Memproses..."
          : "Aktifkan Kartu"}
      </button>
    </form>
  );
}
