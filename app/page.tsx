import Link from "next/link";
export default function Home(){
  return <main className="min-h-screen flex items-center justify-center px-5">
    <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-sm border border-gray-100 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-white text-2xl">★</div>
      <h1 className="text-3xl font-bold">Kartu Review</h1>
      <p className="mt-3 text-gray-600 leading-6">Aktifkan kartu Google Review untuk bisnis Anda.</p>
      <Link href="/activate" className="mt-7 block rounded-2xl bg-black px-5 py-4 font-semibold text-white">Aktivasi Kartu</Link>
    </section>
  </main>;
}