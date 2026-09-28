import { getCardAdapterV2 } from "@/lib/card-adapter-v2";
import V2CustomerLanding from "@/components/V2CustomerLanding";

type Props = {
  params: Promise<{ cardCode: string }>;
};

/**
 * Single customer entry point.
 *
 * QR and NFC both resolve to /{card_code}.
 * This route intentionally uses the V2 adapter so the public card page
 * and the dashboard-configured landing page share the same data source.
 */
export default async function CardEntryPage({ params }: Props) {
  const { cardCode } = await params;
  const code = decodeURIComponent(cardCode).trim().toUpperCase();

  if (!code) {
    return <Fallback title="Halaman tidak tersedia" description="Kode toko belum diberikan." />;
  }

  try {
    const card = await getCardAdapterV2(code);

    if (!card) {
      return <Fallback title="Halaman tidak tersedia" description="Toko tidak ditemukan." />;
    }

    if (!card.active) {
      return <Fallback title="Kartu belum aktif" description="Kartu ini belum diaktifkan atau sedang tidak tersedia." />;
    }

    return <V2CustomerLanding card={card} />;
  } catch (error) {
    console.error("CARD_ENTRY_V2_ERROR:", error);
    return <Fallback title="Halaman tidak tersedia" description="Terjadi kendala saat memuat halaman toko. Silakan coba kembali." />;
  }
}

function Fallback({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f5f3] p-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </section>
    </main>
  );
}
