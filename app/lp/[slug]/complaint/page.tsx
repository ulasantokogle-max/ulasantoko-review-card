"use client";

import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function ComplaintPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug ?? "").toUpperCase();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("Pelayanan");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/v2/complaints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lp_slug: slug, customer_name: name, phone, category, message, is_anonymous: anonymous }),
      });
      const payload = await response.json();
      setStatus(response.ok ? "✓ Keluhan sudah diterima. Tim kami akan menindaklanjutinya." : payload.message ?? "Keluhan gagal dikirim.");
      if (response.ok) {
        setMessage("");
        setName("");
        setPhone("");
      }
    } catch {
      setStatus("Tidak dapat mengirim keluhan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 18, background: "#f3f6f4", fontFamily: "Inter,system-ui,sans-serif" }}>
      <section style={{ maxWidth: 520, margin: "0 auto", background: "white", borderRadius: 24, padding: 24, boxShadow: "0 16px 45px rgba(0,0,0,.07)" }}>
        <a href={`/lp/${slug}`} style={{ color: "#6f7773", textDecoration: "none", fontSize: 13 }}>← Kembali</a>
        <div style={{ marginTop: 22, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#9a6728" }}>LAYANAN PELANGGAN V2</div>
        <h1 style={{ margin: "8px 0 6px" }}>Sampaikan Keluhan</h1>
        <p style={{ color: "#7d8581", lineHeight: 1.6, fontSize: 14 }}>Ceritakan kendala Anda. Kami akan menggunakan informasi ini untuk membantu penanganan.</p>

        <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 22 }}>
          <label>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Kategori</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option>Pelayanan</option>
              <option>Produk</option>
              <option>Pembayaran</option>
              <option>Pengiriman</option>
              <option>Lainnya</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Nama</div>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={anonymous} placeholder="Nama Anda" style={inputStyle} />
          </label>

          <label>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Nomor WhatsApp</div>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={anonymous} placeholder="08xxxxxxxxxx" inputMode="tel" style={inputStyle} />
          </label>

          <label>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Keluhan</div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={7} maxLength={5000} placeholder="Ceritakan kendala Anda..." style={{ ...inputStyle, paddingTop: 12, resize: "vertical" }} />
          </label>

          <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, color: "#69736e" }}>
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Kirim secara anonim
          </label>

          <button disabled={loading} type="submit" style={buttonStyle}>{loading ? "Mengirim..." : "Kirim Keluhan"}</button>
        </form>

        {status && <div style={{ marginTop: 16, padding: 13, borderRadius: 12, background: status.startsWith("✓") ? "#effbf3" : "#fff1f1", color: status.startsWith("✓") ? "#16753b" : "#a32626", fontSize: 13 }}>{status}</div>}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, border: "1px solid #d7dcda", borderRadius: 10, padding: "0 12px", fontSize: 14, boxSizing: "border-box", background: "white" };
const buttonStyle: React.CSSProperties = { minHeight: 46, border: 0, borderRadius: 10, background: "#102b24", color: "white", fontWeight: 800, cursor: "pointer" };
