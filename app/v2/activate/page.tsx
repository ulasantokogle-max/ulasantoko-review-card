"use client";

import { FormEvent, useState } from "react";

export default function V2ActivatePage() {
  const [cardCode, setCardCode] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [publicPath, setPublicPath] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setPublicPath("");

    try {
      const response = await fetch("/api/v2/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ card_code: cardCode, pin }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.message ?? "Aktivasi gagal.");
        return;
      }

      setMessage(`✓ Card ${payload.card_code} aktif untuk ${payload.business_name}.`);
      setPublicPath(payload.public_path);
    } catch {
      setMessage("Tidak dapat terhubung ke sistem V2.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f4f6f5" }}>
      <section style={{ width: "100%", maxWidth: 430, background: "white", borderRadius: 22, padding: 24, boxShadow: "0 14px 40px rgba(0,0,0,.07)" }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: "#9a6728" }}>ULASANTOKO V2</div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 28 }}>Aktivasi Card</h1>
        <p style={{ margin: "0 0 22px", color: "#69716d", fontSize: 14 }}>Masukkan kode LP dan PIN yang diberikan saat pembuatan card.</p>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <label>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Kode Card</div>
            <input
              value={cardCode}
              onChange={(e) => setCardCode(e.target.value.toUpperCase())}
              placeholder="Contoh: LP00101"
              pattern="LP[0-9]{5}"
              required
              style={inputStyle}
            />
          </label>

          <label>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>PIN Aktivasi</div>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6 digit PIN"
              inputMode="numeric"
              maxLength={6}
              required
              style={inputStyle}
            />
          </label>

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Memproses..." : "Aktifkan Card"}
          </button>
        </form>

        {message && <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: publicPath ? "#effbf3" : "#fff1f1", color: publicPath ? "#16753b" : "#a32626", fontSize: 13 }}>{message}</div>}
        {publicPath && (
          <a href={publicPath} style={{ display: "block", marginTop: 12, textAlign: "center", fontWeight: 800, color: "#102b24" }}>
            Buka Landing Page →
          </a>
        )}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "1px solid #d7dcda",
  borderRadius: 10,
  padding: "0 12px",
  fontSize: 15,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  minHeight: 46,
  border: 0,
  borderRadius: 10,
  background: "#102b24",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};
