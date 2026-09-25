"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type FeedbackPage = {
  id: string;
  slug: string;
  business_name: string;
  industry: string | null;
  is_active: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

export default function ComplaintPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [page, setPage] = useState<FeedbackPage | null>(null);
  const [loading, setLoading] = useState(true);

  const [customerName, setCustomerName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadPage() {
      if (!slug) return;

      const { data, error } = await supabase
        .from("feedback_pages")
        .select(
          `
          id,
          slug,
          business_name,
          industry,
          is_active
        `
        )
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("GET_FEEDBACK_PAGE_ERROR:", error);
        setErrorMessage("Halaman tidak dapat dimuat.");
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage("Halaman tidak ditemukan atau sudah tidak aktif.");
        setLoading(false);
        return;
      }

      setPage(data);
      setLoading(false);
    }

    loadPage();
  }, [slug]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!message.trim()) {
      setErrorMessage("Silakan tuliskan keluhan Anda terlebih dahulu.");
      return;
    }

    if (!isAnonymous && !customerName.trim()) {
      setErrorMessage("Silakan isi nama atau pilih opsi anonim.");
      return;
    }

    if (!page) {
      setErrorMessage("Data bisnis tidak ditemukan.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from("feedback_complaints")
      .insert({
        feedback_page_id: page.id,
        customer_name: isAnonymous
          ? null
          : customerName.trim(),
        is_anonymous: isAnonymous,
        message: message.trim(),
        status: "pending",
      });

    if (error) {
      console.error("CREATE_COMPLAINT_ERROR:", error);
      setErrorMessage(
        "Keluhan belum berhasil dikirim. Silakan coba lagi."
      );
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSuccess(true);
    setCustomerName("");
    setMessage("");
    setIsAnonymous(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
          <p className="text-sm text-gray-500">
            Memuat halaman...
          </p>
        </div>
      </main>
    );
  }

  if (errorMessage && !page) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-5">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
            !
          </div>

          <h1 className="text-xl font-bold text-gray-900">
            Halaman Tidak Ditemukan
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-6 w-full rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            Kembali
          </button>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] px-5 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
            <div className="bg-[#0d332b] px-6 py-10 text-center text-white">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl text-[#0d332b]">
                ✓
              </div>

              <h1 className="mt-5 text-2xl font-bold">
                Keluhan Berhasil Dikirim
              </h1>

              <p className="mt-2 text-sm leading-6 text-white/75">
                Terima kasih telah menyampaikan pengalaman Anda.
                Tim {page?.business_name} akan menindaklanjutinya.
              </p>
            </div>

            <div className="p-6">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="w-full rounded-xl bg-black px-5 py-3.5 text-sm font-semibold text-white"
              >
                Kembali
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Powered by <span className="font-semibold">Ulasan Toko</span>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
          {/* Header */}
          <div className="bg-[#0d332b] px-6 py-8 text-center text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-[#0d332b]">
              {page?.business_name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6a24a]">
              Layanan Pelanggan
            </p>

            <h1 className="mt-2 text-2xl font-bold">
              {page?.business_name}
            </h1>
          </div>

          {/* Content */}
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900">
              Sampaikan Keluhan
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Kami menghargai masukan Anda. Sampaikan pengalaman
              atau kendala yang Anda alami agar dapat kami tindaklanjuti.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-5"
            >
              {/* Name */}
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
                  disabled={isAnonymous || submitting}
                  placeholder="Masukkan nama Anda"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400 disabled:bg-gray-100"
                />
              </div>

              {/* Anonymous */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) =>
                    setIsAnonymous(e.target.checked)
                  }
                  disabled={submitting}
                  className="mt-0.5 h-4 w-4"
                />

                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    Kirim secara anonim
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-gray-500">
                    Nama Anda tidak akan ditampilkan pada laporan keluhan.
                  </span>
                </span>
              </label>

              {/* Complaint */}
              <div>
                <label
                  htmlFor="message"
                  className="mb-2 block text-sm font-semibold text-gray-800"
                >
                  Keluhan / Masukan
                </label>

                <textarea
                  id="message"
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value)
                  }
                  disabled={submitting}
                  rows={6}
                  placeholder="Ceritakan pengalaman atau kendala yang Anda alami..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-gray-400 disabled:bg-gray-100"
                />
              </div>

              {/* Error */}
              {errorMessage && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                  {errorMessage}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#0d332b] px-5 py-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Mengirim..."
                  : "Kirim Keluhan"}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Powered by <span className="font-semibold">Ulasan Toko</span>
        </p>
      </div>
    </main>
  );
}
