import type { CardAdapterV2 } from "@/lib/card-adapter-v2";

function getSetting(settings: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = settings[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}

function IconPin() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="9" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>;
}
function IconMessage() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>;
}
function IconArrow() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function V2CustomerLanding({ card }: { card: CardAdapterV2 }) {
  const settings = card.config ?? {};
  const logoUrl = getSetting(settings, "logo_url", "logo", "store_logo_url");
  const coverUrl = getSetting(settings, "cover_url", "cover", "cover_photo_url", "photo_cover_url");
  const coverPosition = getSetting(settings, "cover_position", "coverPosition") ?? "center";
  const whatsappRaw = getSetting(
    settings,
    "whatsapp_owner",
    "owner_whatsapp",
    "whatsapp",
    "whatsapp_number",
    "nomor_whatsapp_owner",
    "no_whatsapp_owner",
    "whatsappOwner",
    "owner_whatsapp_number",
    "nomor_whatsapp",
    "wa_owner",
    "no_wa_owner",
    "customer_service_whatsapp",
    "customerServiceWhatsapp"
  ) ?? "";
  const whatsapp = normalizeWhatsApp(whatsappRaw);
  const placeId = getSetting(settings, "google_place_id", "googlePlaceId", "place_id");
  const googleReviewUrl =
    card.googleReviewUrl ??
    getSetting(
      settings,
      "google_review_url",
      "googleReviewUrl",
      "google_review",
      "link_google_review",
      "link_google_maps"
    ) ??
    (placeId
      ? "https://search.google.com/local/writereview?placeid=" +
        encodeURIComponent(placeId)
      : null);
  const businessName = card.name ?? card.landingPage.title ?? "Toko Anda";
  const headline = card.landingPage.headline ?? "BAGAIMANA PENGALAMAN ANDA HARI INI?";
  const description = card.landingPage.description ?? "Kami selalu ingin memberikan yang terbaik untuk Anda.";
  // V2 must never fall back to the legacy complaint route. When no WhatsApp
  // number is configured yet, keep the CTA non-navigating rather than sending
  // customers into a legacy/404 route.
  const customerServiceHref = whatsapp ? `https://wa.me/${whatsapp}` : null;

  return (
    <main className="min-h-screen bg-[#f4f5f3] px-3 py-4 sm:px-5 sm:py-8">
      <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.10)]">
        <div className="relative h-[170px] overflow-hidden bg-[#e9e4dd] sm:h-[190px]">
          {coverUrl ? (
            <img src={coverUrl} alt="Foto toko" className="h-full w-full object-cover" style={{ objectPosition: coverPosition }} />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#e8ded0] via-[#d6c3ac] to-[#765239]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
        </div>

        <div className="relative px-5 pb-7 sm:px-7">
          <div className="-mt-12 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[22px] border-4 border-white bg-white shadow-lg">
              {logoUrl ? (
                <img src={logoUrl} alt={`Logo ${businessName}`} className="h-full w-full object-contain" />
              ) : (
                <span className="px-2 text-center text-sm font-bold text-slate-700">{businessName}</span>
              )}
            </div>
          </div>

          <div className="mt-5 text-center">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-[#9a6a35]">TERIMA KASIH SUDAH BERKUNJUNG</p>
            <h1 className="mt-3 text-[25px] font-bold leading-tight tracking-[-0.03em] text-[#182522]">{businessName}</h1>
            <div className="mx-auto mt-4 h-1 w-10 rounded-full bg-[#9a5a18]" />
          </div>

          <section className="mt-8 text-center">
            <h2 className="text-[16px] font-bold tracking-[0.02em] text-[#27302e]">{headline}</h2>
            <p className="mx-auto mt-3 max-w-[320px] text-[13px] leading-5 text-[#8b8f8c]">{description}</p>
          </section>

          <div className="my-6 h-px bg-[#ececea]" />

          {card.feedback.enabled && (
            <section className="rounded-[22px] bg-[#fff8ef] p-3.5">
              <div className="flex items-start gap-3 px-2 py-1">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f5e7d6] text-[#a85e12]"><IconPin /></div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-[14px] font-bold text-[#333734]">Bagikan Pengalaman Anda</h3>
                  <p className="mt-1 text-[11px] leading-4 text-[#8b8f8c]">Bantu Bisnis Kami Berkembang dengan ulasan di Google Maps.</p>
                </div>
              </div>
              {googleReviewUrl ? (
                <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#b85d08] px-4 text-[12px] font-bold text-white shadow-sm transition hover:brightness-95">
                  <span aria-hidden="true" className="font-black">G</span><span>Tulis Review di Google Maps</span><IconArrow />
                </a>
              ) : (
                <div className="mt-3 flex min-h-11 items-center justify-center rounded-full bg-[#eadfd2] px-4 text-[11px] font-semibold text-[#9b8d80]">Link Google Review belum tersedia</div>
              )}
            </section>
          )}

          {card.complaint.enabled && (
            <section className="mt-3 rounded-[22px] bg-[#f1f4f3] p-3.5">
              <div className="flex items-start gap-3 px-2 py-1">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e7ebe9] text-[#182b25]"><IconMessage /></div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-[14px] font-bold text-[#333734]">Hubungi Layanan Pelanggan</h3>
                  <p className="mt-1 text-[11px] leading-4 text-[#8b8f8c]">Dapatkan Bantuan Cepat atau Solusi Masalah.</p>
                </div>
              </div>
              {customerServiceHref ? (
                <a href={customerServiceHref} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#142721] px-4 text-[12px] font-bold text-white shadow-sm transition hover:brightness-95">
                  <IconMessage />
                  <span>Hubungi Owner / Customer Service</span>
                  <IconArrow />
                </a>
              ) : (
                <div className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#dfe6e3] px-4 text-[12px] font-bold text-[#6f7c76]" aria-disabled="true">
                  <IconMessage />
                  <span>WhatsApp Owner belum tersedia</span>
                </div>
              )}
            </section>
          )}

          <div className="mt-6 flex justify-center">
            <a
              href={"/settings/" + encodeURIComponent(card.code)}
              className="text-[11px] font-semibold text-slate-400 underline-offset-4 hover:text-slate-600 hover:underline"
            >
              Pengaturan Toko
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}