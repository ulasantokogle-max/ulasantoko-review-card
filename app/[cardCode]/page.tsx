import { notFound } from "next/navigation";
import { getCardAdapter } from "@/lib/card-adapter";
import LP002 from "@/components/lp/lp002";

export const dynamic = "force-dynamic";

export default async function V2CardPage({
  params,
}: {
  params: Promise<{ cardCode: string }>;
}) {
  const { cardCode } = await params;
  const code = decodeURIComponent(cardCode).trim().toUpperCase();

  // V2 single entry point: QR and NFC can both resolve to /{card_code}.
  // All card data is read through Card Adapter V2.
  const card = await getCardAdapter(code);

  if (!card) notFound();

  if (!card.active) {
    return (
      <main className="min-h-screen bg-[#f4f6f4] flex items-center justify-center px-5">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
            ◌
          </div>
          <h1 className="mt-5 text-2xl font-bold text-gray-900">
            Kartu belum aktif
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Kartu ini belum diaktifkan atau sedang tidak tersedia.
          </p>
        </section>
      </main>
    );
  }

  return (
    <LP002
      page={{
        id: card.id,
        page_code: card.code,
        slug: card.code,
        business_name: card.name || "Ulasan Toko",
        logo_url: null,
        cover_url: null,
        primary_color: "#173A32",
        secondary_color: "#D49A3A",
        google_review_url: card.googleReviewUrl,
        review_title: "Bagaimana pengalaman Anda?",
        review_description:
          "Bagikan pengalaman Anda melalui Google. Ulasan Anda sangat berarti bagi kami.",
        complaint_title: "Ada kendala?",
        complaint_description:
          "Sampaikan kendala atau masukan langsung kepada tim kami.",
        industry: null,
      }}
      complaintHref={
        card.complaint.enabled
          ? `/feedback/${encodeURIComponent(card.code)}/complaint`
          : null
      }
    />
  );
}
