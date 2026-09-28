"use client";

import { useCallback, useMemo, useState } from "react";
import { getV2PublicOrigin, getV2PublicUrl } from "@/lib/v2-public-url";
import { getV2PublicUrl } from "@/lib/v2-public-url";

type Card = {
  id: string;
  card_code: string;
  status: "active" | "inactive";
  card_status: "active" | "inactive";
  business_name: string;
  configured: boolean;
  review_ready: boolean;
  logo_url: string | null;
  public_path: string;
  settings_path: string;
  tools_path: string;
  public_url?: string;
  created_at: string;
};

type Created = {
  card_code: string;
  activation_pin: string;
  public_path: string;
  settings_path: string;
  tools_path: string;
  public_url: string;
};

export default function V2AdminCardsDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  const loadCards = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/v2/cards/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", admin_key: adminKey }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal memuat kartu.");
      setCards(d.cards || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat kartu.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  async function createCard(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    setCreated(null);
    try {
      const r = await fetch("/api/v2/cards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_key: adminKey, card_code: code }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal membuat kartu.");
      setCreated(d);
      setCode("");
      setNotice("Kartu V2 berhasil dibuat.");
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat kartu.");
    } finally {
      setCreating(false);
    }
  }

  async function toggle(card: Card) {
    const next = card.card_status === "active" ? "inactive" : "active";
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/v2/cards/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          admin_key: adminKey,
          card_code: card.card_code,
          status: next,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Gagal mengubah status.");
      setNotice(card.card_code + (next === "active" ? " diaktifkan." : " dinonaktifkan."));
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah status.");
    }
  }

  async function copy(path: string) {
    try {
      const fullUrl = /^https?:\/\//i.test(path) ? path : getV2PublicUrl(path.replace(/^\//, ""));
      await navigator.clipboard.writeText(fullUrl);
      setNotice("Link kartu berhasil disalin: " + fullUrl);
    } catch {
      setError("Copy otomatis tidak tersedia di browser ini.");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      c.card_code.toLowerCase().includes(q) ||
      c.business_name.toLowerCase().includes(q)
    );
  }, [cards, query]);

  const active = cards.filter((c) => c.card_status === "active").length;
  const configured = cards.filter((c) => c.configured).length;
  const reviewReady = cards.filter((c) => c.review_ready).length;

  return (
    <main className="min-h-screen bg-[#f4f5f3] px-4 py-7 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="text-xs font-bold tracking-[.24em] text-[#9a6a35]">ULASAN TOKO V2</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#182522]">Dashboard Kartu</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Kelola kartu LP, status, landing page, pengaturan toko, dan QR/NFC. Sistem legacy tetap terpisah.
          </p>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total", cards.length],
            ["Aktif", active],
            ["Sudah Diatur", configured],
            ["Review Siap", reviewReady],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-[#182522]">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={adminKey}
              onChange={(e) => { setAdminKey(e.target.value); setError(""); }}
              type="password"
              placeholder="ADMIN_KEY"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#173A32]"
            />
            <button
              type="button"
              onClick={loadCards}
              disabled={!adminKey || loading}
              className="rounded-2xl bg-[#142721] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? "Memuat..." : "Refresh Data"}
            </button>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-[#182522]">Buat Kartu V2</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Kosongkan kode untuk nomor LP berikutnya.</p>

            <form onSubmit={createCard} className="mt-5 space-y-4">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={!adminKey}
                placeholder="Contoh: LP00101"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#173A32] disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={!adminKey || creating}
                className="w-full rounded-2xl bg-[#142721] px-5 py-4 font-bold text-white disabled:opacity-50"
              >
                {creating ? "Membuat..." : "Buat Kartu"}
              </button>
            </form>

            {created && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-bold text-emerald-800">✓ Kartu dibuat</p>
                <p className="mt-3 text-xs text-slate-500">Kode</p>
                <p className="text-2xl font-black">{created.card_code}</p>
                <p className="mt-3 text-xs text-slate-500">PIN Aktivasi</p>
                <p className="text-3xl font-black tracking-[.28em]">{created.activation_pin}</p>
                <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">
                  Simpan PIN ini. PIN hanya ditampilkan saat kartu dibuat.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a href={created.public_url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#142721] px-2 py-3 text-center text-[11px] font-bold text-white">Landing</a>
                  <a href={created.settings_path} className="rounded-xl border border-slate-300 px-2 py-3 text-center text-[11px] font-bold">Setting</a>
                  <a href={created.tools_path} className="rounded-xl border border-slate-300 px-2 py-3 text-center text-[11px] font-bold">QR/NFC</a>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#182522]">Daftar Kartu</h2>
                <p className="mt-1 text-sm text-slate-500">{filtered.length} kartu ditampilkan · URL customer: {getV2PublicOrigin()}</p>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kode / toko..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none sm:max-w-xs"
              />
            </div>

            {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {notice && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

            {!cards.length && !loading ? (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                Belum ada kartu V2.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {filtered.map((card) => (
                  <article key={card.id} className="rounded-3xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                          {card.logo_url ? <img src={card.logo_url} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">V2</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black tracking-wide">{card.card_code}</span>
                            <span className={card.card_status === "active" ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"}>
                              {card.card_status === "active" ? "AKTIF" : "NONAKTIF"}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold">{card.business_name}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                            <span className={card.configured ? "rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700" : "rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700"}>
                              {card.configured ? "Sudah diatur" : "Belum diatur"}
                            </span>
                            <span className={card.review_ready ? "rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600"}>
                              {card.review_ready ? "Review siap" : "Review belum siap"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => copy(card.public_path)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Copy</button>
                        <a href={card.public_url || getV2PublicUrl(card.card_code)} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Landing</a>
                        <a href={card.settings_path} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">Pengaturan</a>
                        <a href={card.tools_path} className="rounded-xl bg-[#142721] px-3 py-2 text-xs font-bold text-white">QR/NFC</a>
                        <button onClick={() => toggle(card)} className={card.card_status === "active" ? "rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700" : "rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700"}>
                          {card.card_status === "active" ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
