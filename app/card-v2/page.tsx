import { getCardAdapterV2 } from "@/lib/card-adapter-v2";
import V2CustomerLanding from "@/components/V2CustomerLanding";

type Props = { searchParams: Promise<{ code?: string }> };

/**
 * V2 customer entry point.
 *
 * IMPORTANT:
 * - V2-only route.
 * - Legacy `/card` and `/lp/[slug]` are untouched.
 * - Resolve the card once and render the V2 customer UI directly.
 *   This avoids a second API request after a redirect.
 */
export default async function CardV2Page({ searchParams }: Props) {
  const params = await searchParams;
  const code = params.code?.trim().toUpperCase();

  if (!code) {
    return <Fallback title="Card tidak ditemukan" description="Kode card belum diberikan." />;
  }

  try {
    const card = await getCardAdapterV2(code);

    if (!card) {
      return <Fallback title="Card tidak ditemukan" description="API V2 tidak mengembalikan data card." />;
    }

    if (!card.active) {
      return <Fallback title="Card tidak aktif" description={`Card ${card.code} ditemukan, tetapi sedang tidak aktif.`} />;
    }

    return <V2CustomerLanding card={card} />;
  } catch (error) {
    console.error("CARD_V2_ENTRY_ERROR:", error);
    return <Fallback title="Halaman tidak tersedia" description="Terjadi kendala saat memuat card. Silakan coba kembali." />;
  }
}

function Fallback({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f5f3] p-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </section>
    </main>
  );
}
