import { notFound } from "next/navigation";
import { v1SupabaseServer } from "@/lib/v1-supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Same strict Google Review destination policy as the V1 QR redirect. */
function isApprovedV1ReviewUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    if (url.hostname === "maps.app.goo.gl") {
      return /^\/[A-Za-z0-9_-]{10,}$/.test(url.pathname) && !url.search;
    }
    return url.hostname === "search.google.com"
      && url.pathname === "/local/writereview"
      && /^[-_A-Za-z0-9]+$/.test(url.searchParams.get("placeid") ?? "");
  } catch {
    return false;
  }
}

export default async function CardPage({
  params,
}: { params: Promise<{ cardCode: string }> }) {
  const { cardCode } = await params;
  // Next.js already decodes route params. Never double-decode untrusted input.
  const code = (cardCode ?? "").trim().toUpperCase();
  if (!/^ULAS-\d{4,}$/.test(code)) notFound();

  const { data: card, error } = await v1SupabaseServer()
    .from("cards")
    // Never request secret activation_pin_hash or other internal data on a public page.
    .select("card_code,status,business_name,google_review_url")
    .eq("card_code", code)
    .maybeSingle();
  if (error || !card) notFound();

  if (card.status !== "active") {
    return <main className="min-h-screen flex items-center justify-center px-5">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm">
        <h1 className="text-2xl font-bold">
          {card.status === "inactive" ? "Kartu belum aktif" : "Kartu tidak tersedia"}
        </h1>
        {card.status === "inactive" &&
          <p className="mt-3 text-gray-600">Silakan aktivasi kartu terlebih dahulu.</p>}
      </section>
    </main>;
  }

  const safeReviewUrl = isApprovedV1ReviewUrl(card.google_review_url)
    ? card.google_review_url : null;
  return <main className="min-h-screen flex items-center justify-center px-5">
    <section className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-7 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
      <p className="mt-5 text-sm font-semibold text-gray-500">Kartu Review</p>
      <h1 className="mt-1 text-3xl font-bold">{card.business_name}</h1>
      <p className="mt-3 leading-6 text-gray-600">Terima kasih sudah berkunjung. Bantu kami dengan membagikan pengalaman melalui Google Review.</p>
      {safeReviewUrl
        ? <a href={safeReviewUrl} target="_blank" rel="noopener noreferrer"
            className="mt-7 block rounded-2xl bg-black px-5 py-4 font-semibold text-white">
            Berikan Review di Google
          </a>
        : <p className="mt-7 rounded-xl bg-gray-100 p-4 text-sm text-gray-700">
            Tautan Google Review belum valid. Hubungi pengelola kartu.
          </p>}
    </section>
  </main>;
}
