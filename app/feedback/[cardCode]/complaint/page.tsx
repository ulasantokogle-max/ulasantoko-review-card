"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams, useRouter } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

export default function ComplaintPage() {
  const params = useParams();
  const router = useRouter();

  const cardCode = String(params.cardCode || "");

  const [customerName, setCustomerName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setErrorMessage("");

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
       * Ambil feedback page berdasarkan card code.
       * Complaint tetap menggunakan relasi feedback page
       * yang sudah ada.
       */
      const { data: feedbackPage, error: feedbackError } =
        await supabase
          .from("feedback_pages")
          .select("id")
          .eq("card_code", cardCode)
          .maybeSingle();

      if (feedbackError) {
        console.error(
          "FEEDBACK_PAGE_ERROR:",
          feedbackError
        );

        setErrorMessage(
          "Data card gagal ditemukan."
        );

        setLoading(false);
        return;
      }

      if (!feedbackPage) {
        setErrorMessage(
          "Card tidak ditemukan atau belum terdaftar."
        );

        setLoading(false);
        return;
      }

      /*
       * Simpan complaint
       */
      const { error: insertError } = await supabase
        .from("feedback_complaints")
        .insert({
          feedback_page_id: feedbackPage.id,
          customer_name: isAnonymous
            ? null
            : customerName.trim() || null,
          is_anonymous: isAnonymous,
          message: message.trim(),
          status: "new",
        });

      if (insertError) {
        console.error(
          "INSERT_COMPLAINT_ERROR:",
          insertError
        );

        setErrorMessage(
          "Keluhan gagal dikirim. Silakan coba lagi."
        );

        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (error) {
      console.error(
        "COMPLAINT_ERROR:",
        error
      );

      setErrorMessage(
        "Terjadi kesalahan. Silakan coba lagi."
      );

      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-xl">
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl">
              ✓
            </div>

            <h1 className="mt-5 text-2xl font-bold">
              Keluhan Berhasil Dikirim
            </h1>

            <p className="mt-3 text-sm text-gray-500">
              Terima kasih. Keluhan Anda telah kami
              terima dan akan segera kami tindak lanjuti.
            </p>

            <button
              type="button"
              onClick={() => router.back()}
              className="mt-6 w-full rounded-xl bg-black px-5 py-3 font-semibold text-white"
            >
              Kembali
            </button>

          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl">

        <section className="rounded-2xl bg-white p-6 shadow-sm">

          <h1 className="text-2xl font-bold">
            Hubungi Layanan Pelanggan
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Sampaikan kendala atau keluhan Anda kepada
            kami.
          </p>

        </section>

        <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {!isAnonymous && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">
                  Nama
                </label>

                <input
                  type="text"
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(e.target.value)
                  }
                  placeholder="Masukkan nama Anda"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>
            )}

            <div className="flex items-center gap-3">

              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) =>
                  setIsAnonymous(e.target.checked)
                }
                className="h-4 w-4"
              />

              <label
                htmlFor="anonymous"
                className="text-sm text-gray-700"
              >
                Kirim secara anonim
              </label>

            </div>

            <div>

              <label className="mb-2 block text-sm font-semibold text-gray-800">
                Keluhan
              </label>

              <textarea
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                placeholder="Ceritakan pengalaman atau keluhan Anda..."
                rows={7}
                required
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
              />

            </div>

            {errorMessage && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
