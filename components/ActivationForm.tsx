"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivationForm() {
  const router = useRouter();

  const [cardCode, setCardCode] = useState("");

  useEffect(() => {
    const providedCode = new URLSearchParams(window.location.search).get("card_code");
    if (providedCode && /^ULAS-\d{4,}$/.test(providedCode.trim().toUpperCase())) {
      setCardCode(providedCode.trim().toUpperCase());
    }
  }, []);
  const [activationPin, setActivationPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [candidate, setCandidate] = useState<{ placeId: string; name: string; address: string } | null>(null);
  const [candidateConfirmed, setCandidateConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (candidate && !candidateConfirmed) {
      setMessage("Buka tautan ulasan, cocokkan profil Google, lalu centang konfirmasi sebelum mengaktifkan kartu.");
      return;
    }
    setLoading(true);
    setMessage("");

    const normalizedCardCode = cardCode.trim().toUpperCase();
    const normalizedPin = activationPin.trim();

    // Validasi kode kartu
    if (!/^ULAS-\d{4,}$/.test(normalizedCardCode)) {
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
          confirmed_place_id: candidate?.placeId,
        }),
      });

      const data = await res.json();

      if (data.code === "CONFIRM_GOOGLE_PLACE" && data.candidate) {
        setCandidate(data.candidate);
        setCandidateConfirmed(false);
        setMessage("Pastikan nama dan alamat di bawah benar. Klik Konfirmasi & Aktifkan untuk melanjutkan.");
        return;
      }

      if (!res.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Aktivasi gagal."
        );
      }

      router.push(
        "/r-v1/" + encodeURIComponent(normalizedCardCode)
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
          onChange={(e) => { setCardCode(e.target.value.toUpperCase()); setCandidate(null); setCandidateConfirmed(false); setMessage(""); }}
          placeholder="Contoh: ULAS-00125"
          maxLength={24}
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
          type={showPin ? "text" : "password"}
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
          autoComplete="off"
          className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none tracking-[0.35em]"
        />

        <button type="button" onClick={() => setShowPin(!showPin)} className="mt-2 text-sm font-semibold text-blue-700 underline">
          {showPin ? "Sembunyikan PIN" : "Lihat PIN sementara"}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Cocokkan seluruh 6 digit PIN dengan PIN untuk kode kartu ini. Jangan bagikan PIN melalui chat. Jika berbeda, hubungi Provider untuk menerbitkan PIN pengganti.
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
          onChange={(e) => { setBusinessName(e.target.value); setCandidate(null); setCandidateConfirmed(false); setMessage(""); }}
          placeholder="Nama toko / bisnis"
          className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none"
        />
      </label>

      {/* GOOGLE MAPS */}
      <label className="block">
        <span className="text-sm font-semibold">
          Link Google Review / Google Maps
        </span>

        <input
          required
          type="url"
          value={reviewUrl}
          onChange={(e) => {
            setReviewUrl(e.target.value);
            setCandidate(null);
            setCandidateConfirmed(false);
            setMessage("");
          }}
          placeholder="https://maps.app.goo.gl/..."
          className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none"
        />

        <p className="mt-2 text-xs text-gray-500">
          Tempel link berbagi bisnis dari Google Maps (maps.app.goo.gl) atau link ulasan resmi. Sistem V1 akan mencari lokasi dan menyiapkan tujuan Tulis Ulasan otomatis. Jika lokasinya ambigu, periksa pilihan bisnis yang ditampilkan.
        </p>
      </label>

      {candidate && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950" role="status">
          <p className="font-bold">Apakah ini bisnis Anda?</p>
          <p className="mt-2 font-semibold">{candidate.name}</p>
          <p className="mt-1">{candidate.address}</p>
          <p className="mt-2 text-xs font-semibold text-amber-800">Kandidat belum tentu diverifikasi Google. Buka formulir ulasan berikut dan pastikan profil Google benar.</p>
          <a href={"https://search.google.com/local/writereview?placeid=" + encodeURIComponent(candidate.placeId)}
            target="_blank" rel="noopener noreferrer" className="mt-3 block break-all font-semibold text-blue-700 underline">
            Pratinjau formulir Google Review
          </a>
          <label className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-white p-3">
            <input type="checkbox" checked={candidateConfirmed} onChange={e => setCandidateConfirmed(e.target.checked)} className="mt-1" />
            <span>Saya sudah membuka link Google Review dan memastikan nama serta alamat bisnis yang ditampilkan benar.</span>
          </label>
          <p className="mt-2 text-xs">Jika nama dan alamat tidak sesuai, jangan aktifkan. Cari link Google Maps bisnis yang benar.</p>
          <button type="button" onClick={() => { setCandidate(null); setCandidateConfirmed(false); setMessage(""); }}
            className="mt-3 underline">Bukan bisnis saya</button>
        </div>
      )}


      {/* MESSAGE */}
      {message && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      {/* BUTTON */}
      <button
        type="submit"
        disabled={loading || Boolean(candidate && !candidateConfirmed)}
        className="w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white disabled:opacity-50"
      >
        {loading
          ? "Memproses..."
          : candidate ? "Konfirmasi & Aktifkan Kartu" : "Aktifkan Kartu"}
      </button>
    </form>
  );
}
