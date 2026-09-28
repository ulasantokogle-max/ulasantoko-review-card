import { getCardAdapterV2 } from "@/lib/card-adapter-v2";

type Props = { searchParams: Promise<{ code?: string }> };

export default async function CardV2Page({ searchParams }: Props) {
  const params = await searchParams;
  const code = params.code?.trim().toUpperCase();

  if (!code) {
    return <main className="min-h-screen flex items-center justify-center p-6"><div className="text-center"><h1 className="text-2xl font-bold">Card tidak ditemukan</h1><p className="mt-2 text-gray-500">Kode card belum diberikan.</p></div></main>;
  }

  const card = await getCardAdapterV2(code);

  if (!card || !card.active) {
    return <main className="min-h-screen flex items-center justify-center p-6"><div className="text-center"><h1 className="text-2xl font-bold">Card tidak tersedia</h1><p className="mt-2 text-gray-500">Card tidak ditemukan atau sedang tidak aktif.</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{card.name ?? "Review Card"}</h1>
          <p className="mt-2 text-sm text-gray-500">Card Code: {card.code}</p>
        </section>

        {card.googleReviewUrl && (
          <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Bagikan Pengalaman Anda</h2>
            <p className="mt-2 text-sm text-gray-500">Bantu bisnis kami berkembang dengan memberikan ulasan Anda.</p>
            <a href={card.googleReviewUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block rounded-xl bg-black px-5 py-3 text-center font-semibold text-white">Berikan Ulasan Google</a>
          </section>
        )}

        {card.feedback.enabled && card.feedback.pageId && (
          <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Berikan Feedback</h2>
            <p className="mt-2 text-sm text-gray-500">Sampaikan pengalaman Anda melalui halaman feedback bisnis.</p>
            <a href={`/lp/${encodeURIComponent(card.code)}`} className="mt-4 block rounded-xl border px-5 py-3 text-center font-semibold">Buka Halaman Feedback</a>
          </section>
        )}

        {card.complaint.enabled && (
          <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Hubungi Layanan Pelanggan</h2>
            <p className="mt-2 text-sm text-gray-500">Dapatkan bantuan cepat atau sampaikan kendala Anda.</p>
            <a href={`/feedback/${encodeURIComponent(card.code)}/complaint`} className="mt-4 block rounded-xl bg-red-600 px-5 py-3 text-center font-semibold text-white">Hubungi Customer Service</a>
          </section>
        )}
      </div>
    </main>
  );
}
