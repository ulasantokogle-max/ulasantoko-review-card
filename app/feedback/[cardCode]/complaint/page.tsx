"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import { getCardAdapter } from "@/lib/card-adapter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

export default function ComplaintPage() {
  const params = useParams();

  const cardCode = String(params.cardCode || "");

  const [customerName, setCustomerName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMessage("");
    setSuccess(false);

    if (!message.trim()) {
      setErrorMessage("Silakan tuliskan keluhan Anda.");
      return;
    }

    if (!cardCode) {
      setErrorMessage("Kode card tidak ditemukan.");
      return;
    }

    setLoading(true);

    try {
      /*
       * ============================================================
       * 1. CARI CARD BERDASARKAN page_code
       * ============================================================
       *
       * Kita menggunakan tabel V2 feedback_pages.
       * Ini mengikuti Card Adapter V2:
       *
       * feedback_pages.page_code = cardCode
       * feedback_pages.is_active = true
       */

const card = await getCardAdapter(cardCode);

if (!card) {
  console.error(
    "COMPLAINT_CARD_NOT_FOUND:",
    cardCode
  );

  setErrorMessage(
    "Data card gagal ditemukan."
  );

  return;
}

if (!card.complaint.enabled) {
  setErrorMessage(
    "Fitur keluhan untuk card ini sedang tidak tersedia."
  );

  return;
}

      /*
       * ============================================================
       * 2. CEK APAKAH COMPLAINT AKTIF
       * ============================================================
       */

      if (card.complaint_enabled === false) {
        setErrorMessage(
          "Fitur keluhan untuk card ini sedang tidak tersedia."
        );

        return;
      }

      /*
       * ============================================================
       * 3. SIMPAN COMPLAINT
       * ============================================================
       */

      const { error: insertError } = await supabase
        .from("feedback_complaints")
        .insert({
          feedback_page_id: card.id,
          customer_name: isAnonymous
            ? null
            : customerName.trim() || null,
          is_anonymous: isAnonymous,
          message: message.trim(),
          status: "new",
        });

      if (insertError) {
        console.error(
          "COMPLAINT_INSERT_ERROR:",
          insertError
        );

        setErrorMessage(
          "Keluhan gagal dikirim. Silakan coba lagi."
        );

        return;
      }

      /*
       * ============================================================
       * 4. BERHASIL
       * ============================================================
       */

      setSuccess(true);

      setCustomerName("");
      setIsAnonymous(false);
      setMessage("");
    } catch (error) {
      console.error(
        "COMPLAINT_SUBMIT_ERROR:",
        error
      );

      setErrorMessage(
        "Terjadi kesalahan. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl">

        {/* HEADER */}

        <section className="rounded-2xl bg-white p-6 shadow-sm">

          <h1 className="text-2xl font-bold">
            Hubungi Layanan Pelanggan
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Sampaikan kendala atau keluhan Anda kepada kami.
          </p>

        </section>

        {/* FORM */}

        <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* NAMA */}

            <div>

              <label
                htmlFor="customerName"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                Nama
              </label>

              <input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) =>
                  setCustomerName(e.target.value)
                }
                disabled={isAnonymous || loading}
                placeholder="Masukkan nama Anda"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-100"
              />

            </div>

            {/* ANONYMOUS */}

            <div className="flex items-center gap-2">

              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) =>
                  setIsAnonymous(e.target.checked)
                }
                disabled={loading}
                className="h-4 w-4"
              />

              <label
                htmlFor="anonymous"
                className="text-sm text-gray-700"
              >
                Kirim secara anonim
              </label>

            </div>

            {/* KELUHAN */}

            <div>

              <label
                htmlFor="message"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                Keluhan
              </label>

              <textarea
                id="message"
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                placeholder="Ceritakan pengalaman atau keluhan Anda..."
                rows={6}
                required
                disabled={loading}
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-100"
              />

            </div>

            {/* ERROR */}

            {errorMessage && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            {/* SUCCESS */}

            {success && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                Keluhan berhasil dikirim. Terima kasih atas
                masukannya.
              </div>
            )}

            {/* BUTTON */}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Mengirim..."
                : "Kirim Keluhan"}
            </button>

          </form>

        </section>

      </div>
    </main>
  );
}
