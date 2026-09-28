import { getCardAdapterV2 } from "@/lib/card-adapter-v2";
import V2CustomerLanding from "@/components/V2CustomerLanding";

type Props = { params: Promise<{ slug: string }> };

/** Direct V2 landing route. Legacy routes remain untouched. */
export default async function V2LandingPage({ params }: Props) {
  const { slug } = await params;
  const code = decodeURIComponent(slug).trim().toUpperCase();

  if (!code) {
    return <Fallback title="Halaman tidak tersedia" description="Kode toko belum diberikan." />;
  }

  try {
    const card = await getCardAdapterV2(code);

    if (!card || !card.active) {
      return <Fallback title="Halaman tidak tersedia" description="Toko tidak ditemukan atau sedang tidak aktif." />;
    }

    return <V2CustomerLanding card={card} />;
  } catch (error) {
    console.error("LP_V2_ERROR:", error);
    return <Fallback title="Halaman tidak tersedia" description="Terjadi kendala saat memuat halaman toko." />;
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
