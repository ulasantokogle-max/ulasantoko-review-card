"use client";

import { useState } from "react";

type Props = { cardCode: string };

type StoreState = {
  business_name: string;
  google_maps_url: string;
  google_review_url: string;
  whatsapp_owner: string;
  phone: string;
  address: string;
  headline: string;
  description: string;
  review_title: string;
  review_description: string;
  primary_color: string;
  secondary_color: string;
  cover_position: string;
  review_enabled: boolean;
  complaint_enabled: boolean;
  feedback_enabled: boolean;
  logo_url: string;
  cover_url: string;
};

const emptyState: StoreState = {
  business_name: "",
  google_maps_url: "",
  google_review_url: "",
  whatsapp_owner: "",
  phone: "",
  address: "",
  headline: "",
  description: "",
  review_title: "",
  review_description: "",
  primary_color: "#173A32",
  secondary_color: "#D49A3A",
  cover_position: "center",
  review_enabled: true,
  complaint_enabled: true,
  feedback_enabled: true,
  logo_url: "",
  cover_url: "",
};

export default function V2StoreSettingsForm({ cardCode }: Props) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [state, setState] = useState<StoreState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const code = cardCode.toUpperCase();

  async function readSettings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v2/store-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", card_code: code, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "PIN tidak valid.");

      const b = data.business || {};
      const l = data.landing || {};
      const s = l.settings || {};

      setState({
        business_name: b.business_name || l.title || "",
        google_maps_url: s.google_maps_url || "",
        google_review_url: b.google_review_url || "",
        whatsapp_owner: s.whatsapp_owner || b.phone || "",
        phone: s.phone || b.phone || "",
        address: s.address || b.address || "",
        headline: l.headline || "",
        description: l.description || "",
        review_title: s.review_title || "",
        review_description: s.review_description || "",
        primary_color: l.primary_color || "#173A32",
        secondary_color: l.secondary_color || "#D49A3A",
        cover_position: s.cover_position || "center",
        review_enabled: l.review_enabled !== false,
        complaint_enabled: l.complaint_enabled !== false,
        feedback_enabled: l.feedback_enabled !== false,
        logo_url: b.logo_url || "",
        cover_url: s.cover_url || "",
      });
      setUnlocked(true);
      setMessage("Pengaturan toko berhasil dibuka.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tidak dapat membuka pengaturan.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/v2/store-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", card_code: code, pin, settings: state }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Gagal menyimpan.");

      setState((prev) => ({
        ...prev,
        google_review_url: data.business?.google_review_url || prev.google_review_url,
      }));
      setMessage("✓ Pengaturan berhasil disimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan pengaturan.");
    } finally {
      setLoading(false);
    }
  }

  async function upload(type: "logo" | "cover", file: File) {
    setUploading(type);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.append("card_code", code);
      form.append("pin", pin);
      form.append("type", type);
      form.append("file", file);

      const res = await fetch("/api/v2/store-settings/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Upload gagal.");

      setState((prev) => type === "logo" ? { ...prev, logo_url: data.url } : { ...prev, cover_url: data.url });
      setMessage(type === "logo" ? "✓ Logo berhasil diupload." : "✓ Foto sampul berhasil diupload.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload gagal.");
    } finally {
      setUploading(null);
    }
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-[#f4f5f3] px-4 py-8">
        <section className="mx-auto max-w-md rounded-3xl border border-black/5 bg-white p-7 shadow-[0_18px_55px_rgba(0,0,0,.08)]">
          <p className="text-xs font-bold tracking-[.22em] text-[#9a6a35]">ULASAN TOKO V2</p>
          <h1 className="mt-2 text-2xl font-bold text-[#182522]">Pengaturan Toko</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Kelola logo, nama toko, Google Maps, WhatsApp, foto sampul, dan tampilan landing page.</p>
          <div className="mt-7 rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Kode Kartu</p><p className="mt-1 text-lg font-bold">{code}</p></div>
          <label className="mt-5 block">
            <span className="text-sm font-semibold">PIN Aktivasi</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" maxLength={6} placeholder="6 digit PIN" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 tracking-[.35em] outline-none focus:border-[#173A32]" />
          </label>
          {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {message && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
          <button type="button" onClick={readSettings} disabled={loading || pin.length !== 6} className="mt-5 w-full rounded-2xl bg-[#142721] px-5 py-4 font-bold text-white disabled:opacity-50">{loading ? "Memeriksa..." : "Buka Pengaturan"}</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5f3] px-4 py-6 sm:py-10">
      <section className="mx-auto max-w-2xl rounded-3xl border border-black/5 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,.08)] sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div><p className="text-xs font-bold tracking-[.22em] text-[#9a6a35]">ULASAN TOKO V2</p><h1 className="mt-1 text-2xl font-bold">Pengaturan Toko</h1><p className="mt-1 text-sm text-slate-500">Kartu {code}</p></div>
          <a href={"/" + code} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Lihat Landing</a>\n          <a href={"/card-tools/" + encodeURIComponent(code)} className="rounded-xl bg-[#142721] px-3 py-2 text-xs font-semibold text-white">QR & NFC</a>
        </div>

        <form onSubmit={saveSettings} className="mt-7 space-y-7">
          <section>
            <h2 className="text-base font-bold">Identitas Toko</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="text-sm font-semibold">Nama Toko</span><input value={state.business_name} onChange={(e) => setState({ ...state, business_name: e.target.value })} className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
              <label className="block sm:col-span-2"><span className="text-sm font-semibold">Alamat</span><textarea rows={2} value={state.address} onChange={(e) => setState({ ...state, address: e.target.value })} className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
              <label className="block"><span className="text-sm font-semibold">Nomor WhatsApp Owner</span><input value={state.whatsapp_owner} onChange={(e) => setState({ ...state, whatsapp_owner: e.target.value })} placeholder="08xxxxxxxxxx" className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
              <label className="block"><span className="text-sm font-semibold">Nomor Telepon</span><input value={state.phone} onChange={(e) => setState({ ...state, phone: e.target.value })} className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold">Google Maps & Review</h2>
            <p className="mt-1 text-sm text-slate-500">Masukkan link Google Maps seperti sistem lama. V2 akan membuat link review otomatis dari Place ID.</p>
            <label className="mt-4 block"><span className="text-sm font-semibold">Link Google Maps</span><input type="url" value={state.google_maps_url} onChange={(e) => setState({ ...state, google_maps_url: e.target.value })} placeholder="https://maps.app.goo.gl/..." className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
            {state.google_review_url && <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-xs text-emerald-800 break-all"><strong>Link Review aktif:</strong> {state.google_review_url}</div>}
          </section>

          <section>
            <h2 className="text-base font-bold">Logo & Foto Sampul</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-semibold">Logo Toko</p><div className="mt-3 flex items-center gap-3"><div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">{state.logo_url ? <img src={state.logo_url} alt="Logo" className="h-full w-full object-contain" /> : null}</div><label className="cursor-pointer rounded-xl bg-[#142721] px-3 py-2 text-xs font-bold text-white">{uploading === "logo" ? "Upload..." : "Pilih Logo"}<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload("logo", e.target.files[0])} /></label></div></div>
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-semibold">Foto Sampul</p><div className="mt-3 h-28 overflow-hidden rounded-2xl bg-slate-100">{state.cover_url ? <img src={state.cover_url} alt="Sampul" className="h-full w-full object-cover" /> : null}</div><label className="mt-3 inline-block cursor-pointer rounded-xl bg-[#142721] px-3 py-2 text-xs font-bold text-white">{uploading === "cover" ? "Upload..." : "Pilih Sampul"}<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload("cover", e.target.files[0])} /></label></div>
            </div>
            <label className="mt-4 block"><span className="text-sm font-semibold">Posisi Foto Sampul</span><select value={state.cover_position} onChange={(e) => setState({ ...state, cover_position: e.target.value })} className="mt-2 w-full rounded-2xl border px-4 py-3"><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label>
          </section>

          <section>
            <h2 className="text-base font-bold">Teks Landing Page</h2>
            <div className="mt-4 grid gap-4">
              <label className="block"><span className="text-sm font-semibold">Headline</span><input value={state.headline} onChange={(e) => setState({ ...state, headline: e.target.value })} placeholder="BAGAIMANA PENGALAMAN ANDA HARI INI?" className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
              <label className="block"><span className="text-sm font-semibold">Description</span><textarea rows={3} value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
              <label className="block"><span className="text-sm font-semibold">Judul Review</span><input value={state.review_title} onChange={(e) => setState({ ...state, review_title: e.target.value })} placeholder="Bagikan Pengalaman Anda" className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
              <label className="block"><span className="text-sm font-semibold">Deskripsi Review</span><textarea rows={2} value={state.review_description} onChange={(e) => setState({ ...state, review_description: e.target.value })} placeholder="Bantu Bisnis Kami Berkembang dengan ulasan di Google Maps." className="mt-2 w-full rounded-2xl border px-4 py-3 outline-none" /></label>
            </div>
          </section>

          <section>
            <h2 className="text-base font-bold">Warna & Fitur</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-semibold">Warna Utama</span><input type="color" value={state.primary_color} onChange={(e) => setState({ ...state, primary_color: e.target.value })} className="mt-2 h-12 w-full rounded-xl border p-1" /></label><label className="block"><span className="text-sm font-semibold">Warna Tombol Review</span><input type="color" value={state.secondary_color} onChange={(e) => setState({ ...state, secondary_color: e.target.value })} className="mt-2 h-12 w-full rounded-xl border p-1" /></label></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {([["review_enabled", "Google Review"], ["complaint_enabled", "Customer Service"], ["feedback_enabled", "Feedback"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold"><input type="checkbox" checked={state[key]} onChange={(e) => setState({ ...state, [key]: e.target.checked })} />{label}</label>
              ))}
            </div>
          </section>

          {error && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {message && <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[#142721] px-5 py-4 font-bold text-white disabled:opacity-50">{loading ? "Menyimpan..." : "Simpan Pengaturan"}</button>
        </form>
      </section>
    </main>
  );
}
