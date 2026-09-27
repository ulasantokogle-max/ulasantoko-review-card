"use client";

import { FormEvent, useEffect, useState } from "react";

type CreatedCard = {
  card_code: string;
  lp_slug: string;
  activation_pin: string;
  public_path: string;
};

type CardRow = {
  id: string;
  card_code: string;
  status: string;
  activated_at: string | null;
  created_at: string;
  v2_businesses: {
    business_code: string;
    business_name: string;
    google_review_url: string | null;
  } | null;
  v2_landing_pages: {
    lp_slug: string;
    is_active: boolean;
    template_key: string;
  } | null;
};

export default function V2CardsAdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [created, setCreated] = useState<CreatedCard | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCards() {
    if (!adminKey) return;

    const response = await fetch("/api/v2/cards", {
      headers: { "x-admin-key": adminKey },
    });

    const payload = await response.json();
    if (response.ok) {
      setCards(payload.cards ?? []);
    } else {
      setMessage(payload.message ?? "Gagal memuat card.");
    }
  }

  useEffect(() => {
    void loadCards();
    // Admin key is intentionally not persisted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setCreated(null);

    try {
      const response = await fetch("/api/v2/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          business_name: businessName,
          google_review_url: reviewUrl,
          google_place_id: placeId,
          address,
          phone,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.message ?? "Card V2 gagal dibuat.");
        return;
      }

      setCreated(payload.card);
      setBusinessName("");
      setReviewUrl("");
      setPlaceId("");
      setAddress("");
      setPhone("");
      await loadCards();
    } catch {
      setMessage("Tidak dapat terhubung ke API V2.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f5", padding: 24 }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: "#9a6728" }}>
            ULASANTOKO V2 STANDALONE
          </div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>Create V2 Card</h1>
          <p style={{ margin: 0, color: "#69716d" }}>
            Sistem baru. Tidak membaca atau mengubah tabel legacy.
          </p>
        </header>

        <section style={{ background: "white", borderRadius: 20, padding: 22, boxShadow: "0 10px 30px rgba(0,0,0,.06)", marginBottom: 20 }}>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <label>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Admin Key</div>
              <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} type="password" required style={inputStyle} />
            </label>

            <label>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Nama Bisnis</div>
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Contoh: Gado-Gado MM Desi" required style={inputStyle} />
            </label>

            <label>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Google Review URL</div>
              <input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." style={inputStyle} />
            </label>

            <label>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Google Place ID <span style={{ color: "#999", fontWeight: 500 }}>(opsional)</span></div>
              <input value={placeId} onChange={(e) => setPlaceId(e.target.value)} placeholder="ChIJ..." style={inputStyle} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Alamat</div>
                <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Telepon</div>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              </label>
            </div>

            <button disabled={loading || !adminKey} type="submit" style={buttonStyle}>
              {loading ? "Membuat..." : "Create V2 Card"}
            </button>
          </form>

          {message && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#fff1f1", color: "#a32626", fontSize: 13 }}>
              {message}
            </div>
          )}

          {created && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 14, background: "#effbf3", border: "1px solid #ccebd5" }}>
              <strong style={{ color: "#16753b" }}>✓ Card V2 berhasil dibuat</strong>
              <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 14 }}>
                <div><b>Card / LP Code:</b> {created.card_code}</div>
                <div><b>LP Slug:</b> {created.lp_slug}</div>
                <div><b>PIN Aktivasi:</b> <span style={{ fontSize: 22, letterSpacing: 4, fontWeight: 800 }}>{created.activation_pin}</span></div>
                <div><b>Public URL:</b> <a href={created.public_path} target="_blank" rel="noreferrer">{created.public_path}</a></div>
              </div>
              <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#fff8dd", color: "#735500", fontSize: 12 }}>
                PIN hanya ditampilkan saat card dibuat. Database hanya menyimpan hash PIN.
              </div>
            </div>
          )}
        </section>

        <section style={{ background: "white", borderRadius: 20, padding: 22, boxShadow: "0 10px 30px rgba(0,0,0,.06)" }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>V2 Cards</h2>
          {!adminKey ? (
            <p style={{ color: "#777" }}>Masukkan Admin Key untuk melihat daftar.</p>
          ) : cards.length === 0 ? (
            <p style={{ color: "#777" }}>Belum ada card V2.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Business</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Public</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr key={card.id}>
                      <td style={tdStyle}><b>{card.card_code}</b></td>
                      <td style={tdStyle}>{card.v2_businesses?.business_name ?? "-"}</td>
                      <td style={tdStyle}>{card.status}</td>
                      <td style={tdStyle}>
                        {card.v2_landing_pages ? <a href={`/lp/${card.v2_landing_pages.lp_slug}`} target="_blank" rel="noreferrer">/lp/{card.v2_landing_pages.lp_slug}</a> : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  border: "1px solid #d7dcda",
  borderRadius: 10,
  padding: "0 12px",
  fontSize: 14,
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

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #e6e9e7",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  borderBottom: "1px solid #eef0ef",
};
