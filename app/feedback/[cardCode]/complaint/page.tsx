"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import { getCardAdapter } from "@/lib/card-adapter";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ComplaintPage() {
  const params = useParams();
  const cardCode = String(params.cardCode || "").trim();

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
      const card = await getCardAdapter(cardCode);

      if (!card) {
        setErrorMessage("Data card gagal ditemukan.");
        return;
      }

      if (!card.complaint.enabled || !card.feedback.pageId) {
        setErrorMessage("Fitur keluhan untuk card ini sedang tidak tersedia.");
        return;
      }

      // feedback_complaints.feedback_page_id must reference the V2
      // feedback_pages row, not the legacy cards.id.
      const { error: insertError } = await supabase
        .from("feedback_complaints")
        .insert({
          feedback_page_id: card.feedback.pageId,
          customer_name: isAnonymous ? null : customerName.trim() || null,
          is_anonymous: isAnonymous,
          message: message.trim(),
          status: "pending",
        });

      if (insertError) {
        console.error("COMPLAINT_INSERT_ERROR:", insertError);
        setErrorMessage("Keluhan gagal dikirim. Silakan coba lagi.");
        return;
      }

      setSuccess(true);
      setCustomerName("");
      setIsAnonymous(false);
      setMessage("");
    } catch (error) {
      console.error("COMPLAINT_SUBMIT_ERROR:", error);
      setErrorMessage("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Hubungi Layanan Pelanggan</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sampaikan kendala atau keluhan Anda kepada kami.
          </p>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="customerName" className="mb-2 block text-sm font-semibold text-gray-800">
                Nama
              </label>
              <input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={isAnonymous || loading}
                placeholder="Masukkan nama Anda"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                disabled={loading}
                className="h-4 w-4"
              />
              <label htmlFor="anonymous" className="text-sm text-gray-700">
                Kirim secara anonim
              </label>
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block text-sm font-semibold text-gray-800">
                Keluhan
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ceritakan pengalaman atau keluhan Anda..."
                rows={6}
                required
                disabled={loading}
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-100"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                Keluhan berhasil dikirim. Terima kasih atas masukannya.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Mengirim..." : "Kirim Keluhan"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
