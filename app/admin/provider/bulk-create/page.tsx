"use client";
import { useEffect, useState } from "react";

type CreatedCard = { card_code: string; activation_pin: string; url: string };
export default function BulkCreateV1Page() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [count, setCount] = useState(10);
  const [cards, setCards] = useState<CreatedCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [csvSaved, setCsvSaved] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/v1/provider/session", { cache: "no-store" })
      .then(r => r.json()).then(d => setAuthenticated(d.authenticated === true))
      .catch(() => setAuthenticated(false)).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!cards.length || csvSaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [cards.length, csvSaved]);

  async function create() {
    if (cards.length > 0 && !csvSaved) {
      setMessage("Download CSV dan PIN dari batch sebelumnya sebelum membuat kartu baru.");
      return;
    }
    if (!window.confirm("Buat " + count + " kartu V1 baru? PIN hanya terlihat sekali. Simpan hasil CSV.")) return;
    setCards([]); setCsvSaved(false); setMessage(""); setBusy(true);
    try {
      const res = await fetch("/api/v1/provider/bulk-create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membuat kartu");
      setCards(data.cards);
      setMessage("Batch berhasil. Download CSV sekarang karena PIN tidak dapat diambil kembali.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Permintaan gagal.");
    } finally { setBusy(false); }
  }

  function download() {
    const rows = [["card_code", "activation_pin", "url"], ...cards.map(c => [c.card_code, c.activation_pin, c.url])];
    const csv = rows.map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "V1-Bulk-Kartu.csv"; link.click();
    URL.revokeObjectURL(link.href);
    setCsvSaved(true);
  }
  return <main className="min-h-screen bg-gray-50 px-5 py-10">
    <section className="mx-auto max-w-3xl rounded-3xl border bg-white p-7 shadow-sm">
      <p className="text-xs font-bold text-blue-700">ULASANTOKO V1 · PROVIDER</p>
      <h1 className="mt-2 text-2xl font-bold">Bulk Create V1</h1>
      <p className="mt-2 text-sm text-gray-600">Buat kartu massal dengan kode ULAS berurutan dan PIN aktivasi masing-masing.</p>
      {checking ? <p className="mt-6">Memeriksa sesi Provider...</p>
        : !authenticated ? <p className="mt-6">Silakan <a className="text-blue-700 underline" href="/admin/provider">login Provider V1</a> terlebih dahulu.</p>
        : <>
          <label className="mt-6 block text-sm font-semibold" htmlFor="count">Jumlah kartu (1–100)</label>
          <input id="count" className="my-3 block w-40 rounded-xl border p-3" type="number"
            min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value))}/>
          <button onClick={create} disabled={busy || !Number.isInteger(count) || count < 1 || count > 100}
            className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? "Membuat..." : "Buat Kartu Massal"}
          </button>
          {message && <p role="status" className="mt-4 rounded-xl bg-gray-100 p-3 text-sm">{message}</p>}
          {cards.length > 0 && <div className="mt-5">
            <button onClick={download} className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white">
              Download CSV + PIN
            </button>
            <p className="mt-3 text-sm">{cards.length} kartu baru berhasil dibuat. Simpan file CSV secara aman. {csvSaved ? "CSV telah diminta untuk diunduh." : "Jangan tutup halaman sebelum mengunduh CSV."}</p>
            <div className="mt-3 max-h-72 overflow-auto">
              <table className="w-full text-left text-sm"><thead><tr><th>Kode</th><th>PIN</th></tr></thead>
                <tbody>{cards.map(c => <tr className="border-t" key={c.card_code}>
                  <td className="py-2">{c.card_code}</td><td>{c.activation_pin}</td>
                </tr>)}</tbody></table>
            </div>
          </div>}
        </>}
      <nav className="mt-8 flex flex-wrap gap-5 text-sm text-blue-700">
        <a href="/admin/provider">Provider V1</a><a href="/admin/provider/bulk-designer">Bulk Designer</a>
      </nav>
    </section>
  </main>;
}
