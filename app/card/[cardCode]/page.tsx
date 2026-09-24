import {notFound} from "next/navigation";
import {supabaseServer} from "@/lib/supabase";
export default async function CardPage({params}:{params:Promise<{cardCode:string}>}){
  const {cardCode}=await params; const code=decodeURIComponent(cardCode);
  const {data:card}=await supabaseServer().from("cards").select("*").eq("card_code",code).maybeSingle();
  if(!card) notFound();
  if(card.status!=="active") return <main className="min-h-screen flex items-center justify-center px-5"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm"><h1 className="text-2xl font-bold">Kartu belum aktif</h1><p className="mt-3 text-gray-600">Silakan aktivasi kartu terlebih dahulu.</p></section></main>;
  return <main className="min-h-screen flex items-center justify-center px-5"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm border border-gray-100">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
    <p className="mt-5 text-sm font-semibold text-gray-500">Kartu Review</p>
    <h1 className="mt-1 text-3xl font-bold">{card.business_name}</h1>
    <p className="mt-3 text-gray-600 leading-6">Terima kasih sudah berkunjung. Bantu kami dengan membagikan pengalaman melalui Google Review.</p>
    <a href={card.google_review_url} target="_blank" rel="noopener noreferrer" className="mt-7 block rounded-2xl bg-black px-5 py-4 font-semibold text-white">Berikan Review di Google</a>
  </section></main>;
}