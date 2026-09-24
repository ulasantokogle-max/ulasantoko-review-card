"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function ActivationForm(){
  const router=useRouter();
  const [cardCode,setCardCode]=useState("");
  const [businessName,setBusinessName]=useState("");
  const [reviewUrl,setReviewUrl]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();setLoading(true);setMessage("");
    try{
      const res=await fetch("/api/cards/activate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cardCode,businessName,reviewUrl})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||"Aktivasi gagal");
      router.push("/card/"+encodeURIComponent(cardCode.trim()));
    }catch(err:any){setMessage(err.message)}finally{setLoading(false)}
  }
  return <form onSubmit={submit} className="mt-7 space-y-5 rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
    <label className="block"><span className="text-sm font-semibold">Kode Kartu</span>
      <input required value={cardCode} onChange={e=>setCardCode(e.target.value)} placeholder="Contoh: ULAS-00125" className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none"/>
    </label>
    <label className="block"><span className="text-sm font-semibold">Nama Bisnis</span>
      <input required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Nama toko / bisnis" className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none"/>
    </label>
<label className="block">
  <span className="text-sm font-semibold">Link Google Review</span>
  <input
    required
    type="url"
    value={reviewUrl}
    onChange={e => setReviewUrl(e.target.value)}
    placeholder="https://search.google.com/local/writereview?placeid=..."
    className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none"
  />
  <p className="mt-2 text-xs text-gray-500">
    Masukkan link langsung untuk pelanggan menulis ulasan di Google.
  </p>
</label>
    {message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    <button disabled={loading} className="w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white disabled:opacity-50">{loading?"Memproses...":"Aktifkan Kartu"}</button>
  </form>;
}
