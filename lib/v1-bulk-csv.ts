/**
 * Validate the exact one-time CSV exported by V1 Bulk Create.
 * Distinct from V3/WiV1: overlapping ULAS codes must never allow a wrong
 * printed QR link. The V1 origin and card code must match on every row.
 */
const V1_BASE = "https://app.ulasantoko.space/r-v1/";

function parseCsvRows(raw: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = raw.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else {
      if (ch === '"') {
        if (cell.length !== 0) throw new Error("Format CSV tidak valid.");
        quoted = true;
      } else if (ch === ",") {
        row.push(cell); cell = "";
      } else if (ch === "\n" || ch === "\r") {
        row.push(cell); cell = "";
        if (row.some(x => x.trim() !== "")) lines.push(row);
        row = [];
        if (ch === "\r" && source[i+1] === "\n") i++;
      } else cell += ch;
    }
  }
  if (quoted) throw new Error("Tanda kutip CSV belum ditutup.");
  row.push(cell);
  if (row.some(x => x.trim() !== "")) lines.push(row);
  return lines;
}

export function parseV1BulkCsv(raw: string): string[] {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) throw new Error("CSV V1 belum memiliki data kartu.");
  const headers = rows[0].map(x => x.trim().toLowerCase());
  const codeIndex = headers.indexOf("card_code");
  const urlIndex = headers.indexOf("url");
  const pinIndex = headers.indexOf("activation_pin");
  if (codeIndex < 0 || urlIndex < 0 || pinIndex < 0 ||
      new Set(headers).size !== headers.length) {
    throw new Error("Gunakan CSV asli dari Bulk Create V1 (card_code, activation_pin, url).");
  }
  const codes: string[] = [];
  const found = new Set<string>();
  for (const row of rows.slice(1)) {
    if (row.length !== headers.length) throw new Error("Jumlah kolom CSV tidak sesuai.");
    const code = row[codeIndex].trim().toUpperCase();
    const url = row[urlIndex].trim();
    if (!/^ULAS-\d{5,}$/.test(code) || found.has(code)) {
      throw new Error("Kode kartu V1 tidak valid atau duplikat di CSV.");
    }
    if (url !== V1_BASE + encodeURIComponent(code)) {
      throw new Error("URL QR bukan milik V1 atau tidak cocok dengan kode kartu.");
    }
    found.add(code);
    codes.push(code);
  }
  if (codes.length < 1 || codes.length > 200) {
    throw new Error("Jumlah kartu CSV harus 1–200.");
  }
  return codes;
}
