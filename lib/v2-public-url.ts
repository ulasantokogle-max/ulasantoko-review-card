const DEFAULT_V2_PUBLIC_ORIGIN = "https://review.ulasantoko.space";

export function getV2PublicOrigin() {
  const configured = (
    process.env.NEXT_PUBLIC_V2_PUBLIC_ORIGIN ||
    DEFAULT_V2_PUBLIC_ORIGIN
  ).trim();

  return configured.replace(/\/$/, "");
}

export function getV2PublicUrl(cardCode: string) {
  const code = String(cardCode).trim().toUpperCase();
  return getV2PublicOrigin() + "/" + encodeURIComponent(code);
}
