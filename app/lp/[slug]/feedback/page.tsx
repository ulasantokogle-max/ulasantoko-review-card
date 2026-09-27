"use client";

import { FormEvent, useState } from "react";

export default function FeedbackPage({ params }: { params: { slug: string } }) {
  const slug = params.slug.toUpperCase();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/v2/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lp_slug: slug, rating, customer_name: name, message, is_anonymous: anonymous }),
      });
      const payload = await response.json();
      setStatus(response.ok ? "✓ Terima kasih. Feedback Anda sudah diterima." : payload.message ?? "Feedback gagal dikirim.");
      if (response.ok) {
        setMessage("");
        setName("");
      }
    } catch {
      setStatus("Tidak dapat mengirim feedback.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 18, background: "#f3f6f4", fontFamily: "Inter,system-ui,sans-serif" }}>
      <section style={{ maxWidth: 520, margin: "0 auto", background: "white", borderRadius: 24, padding: 24, boxShadow: "0 16px 45px rgba(0,0,0,.07)" }}>
        <a href={`/lp/${slug}`} style={{ color: "#6f7773", textDecoration: "none", fontSize: 13 }}>← Kembali</a>
        <div style={{ marginTop: 22, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#9a6728" }}>FEEDBACK V2</div>
        <h1 style={{ margin: "8px 0 6px" }}>Bagikan Pengalaman</h1>
        <p style={{ color: "#7d8581", lineHeight: 1.6, fontSize: 14 }}>Masukan Anda membantu bisnis memberikan pengalaman yang lebih baik.</p>

        <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Rating</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} bintang`} style={{ border: 0, background: "transparent", fontSize: 31, color: value <= rating ? "#e29a22" : "#d6dcda", cursor: "pointer", padding: 0 }}>★</button>
              ))}
            </div>
          </div>

          <label>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Nama</div>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={anonymous} placeholder="Nama Anda" style={inputStyle} />
          </label>

          <label>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Feedback</div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={6} maxLength={3000} placeholder="Ceritakan pengalaman Anda..." style={{ ...inputStyle, paddingTop: 12, resize: "vertical" }} />
          </label>

          <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, color: "#69736e" }}>
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Kirim sebagai anonim
          </label>

          <button disabled={loading} type="submit" style={buttonStyle}>{loading ? "Mengirim..." : "Kirim Feedback"}</button>
        </form>

        {status && <div style={{ marginTop: 16, padding: 13, borderRadius: 12, background: status.startsWith("✓") ? "#effbf3" : "#fff1f1", color: status.startsWith("✓") ? "#16753b" : "#a32626", fontSize: 13 }}>{status}</div>}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, border: "1px solid #d7dcda", borderRadius: 10, padding: "0 12px", fontSize: 14, boxSizing: "border-box" };
const buttonStyle: React.CSSProperties = { minHeight: 46, border: 0, borderRadius: 10, background: "#102b24", color: "white", fontWeight: 800, cursor: "pointer" };
