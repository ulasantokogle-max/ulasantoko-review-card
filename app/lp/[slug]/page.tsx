import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type FeedbackPage = {
  id: string;
  page_code: string;
  slug: string;
  business_name: string;
  google_review_url: string | null;
  template_key: string | null;
  industry: string | null;

  review_title: string | null;
  review_description: string | null;

  complaint_title: string | null;
  complaint_description: string | null;

  is_active: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

async function getFeedbackPage(slug: string) {
  const { data, error } = await supabase
    .from("feedback_pages")
    .select(`
      id,
      page_code,
      slug,
      business_name,
      google_review_url,
      template_key,
      industry,
      review_title,
      review_description,
      complaint_title,
      complaint_description,
      is_active
    `)
    .eq("page_code", slug.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("LP_ENGINE_ERROR:", error);
    return null;
  }

  return data as FeedbackPage | null;
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await getFeedbackPage(slug);

  if (!page) {
    notFound();
  }

  const reviewTitle =
    page.review_title || "Bagikan Pengalaman Anda";

  const reviewDescription =
    page.review_description ||
    "Bantu bisnis kami berkembang dengan ulasan di Google Maps.";

  const complaintTitle =
    page.complaint_title || "Hubungi Layanan Pelanggan";

  const complaintDescription =
    page.complaint_description ||
    "Dapatkan bantuan cepat atau solusi masalah.";

  return (
    <main className="min-h-screen bg-[#f8f8f6] px-4 py-8">
      <div className="mx-auto w-full max-w-md">

        {/* CARD UTAMA */}
        <section className="overflow-hidden rounded-[28px] bg-white shadow-xl">

          {/* HEADER */}
          <div className="px-7 pb-8 pt-10 text-center">

            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#a66a2c]">
              Terima kasih sudah berkunjung
            </p>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#202522]">
              {page.business_name}
            </h1>

            <div className="mx-auto mt-4 h-1 w-12 rounded-full bg-[#a66a2c]" />

            <h2 className="mt-7 text-lg font-bold text-[#272b29]">
              Bagaimana pengalaman Anda hari ini?
            </h2>

            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-gray-500">
              Kami selalu ingin memberikan yang terbaik untuk Anda.
            </p>
          </div>

          {/* GOOGLE REVIEW */}
          <div className="mx-5 mb-4 rounded-[22px] bg-[#fff7ef] p-5">

            <div className="flex gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f6e7d5] text-xl">
                📍
              </div>

              <div>
                <h3 className="font-bold text-[#303432]">
                  {reviewTitle}
                </h3>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {reviewDescription}
                </p>
              </div>

            </div>

            {page.google_review_url ? (
              <a
                href={page.google_review_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#b95f08] px-5 py-3.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                <span className="text-base">G</span>
                <span>Tulis Review di Google Maps</span>
                <span>→</span>
              </a>
            ) : (
              <div className="mt-4 rounded-full bg-gray-200 px-5 py-3.5 text-center text-sm font-semibold text-gray-500">
                Link Google Review belum tersedia
              </div>
            )}

          </div>

          {/* COMPLAINT */}
          <div className="mx-5 mb-7 rounded-[22px] bg-[#f1f4f2] p-5">

            <div className="flex gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl">
                💬
              </div>

              <div>
                <h3 className="font-bold text-[#303432]">
                  {complaintTitle}
                </h3>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {complaintDescription}
                </p>
              </div>

            </div>

            <a
              href={`/complaint/${page.page_code}`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#12231e] px-5 py-3.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              <span>☑</span>
              <span>Hubungi Owner / Customer Service</span>
              <span>→</span>
            </a>

          </div>

        </section>

        {/* FOOTER */}
        <p className="mt-6 text-center text-[10px] text-gray-400">
          Powered by UlasanToko
        </p>

      </div>
    </main>
  );
}
