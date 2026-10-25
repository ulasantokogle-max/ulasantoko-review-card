import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type V2Page = {
  lp_slug: string;
  template_key: string;
  title: string | null;
  headline: string | null;
  description: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  review_enabled: boolean;
  complaint_enabled: boolean;
  feedback_enabled: boolean;
  v2_cards: {
    card_code: string;
    status: string;
    v2_businesses: {
      business_name: string;
      google_review_url: string | null;
      logo_url: string | null;
      address: string | null;
    } | null;
  } | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getPage(slug: string): Promise<V2Page | null> {
  const normalized = decodeURIComponent(slug).trim().toUpperCase();

  const { data, error } = await supabase
    .from("v2_landing_pages")
    .select(`
      lp_slug,
      template_key,
      title,
      headline,
      description,
      primary_color,
      secondary_color,
      review_enabled,
      complaint_enabled,
      feedback_enabled,
      v2_cards!inner (
        card_code,
        status,
        v2_businesses!inner (
          business_name,
          google_review_url,
          logo_url,
          address
        )
      )
    `)
    .eq("lp_slug", normalized)
    .eq("is_active", true)
    .eq("v2_cards.status", "active")
    .eq("v2_cards.v2_businesses.status", "active")
    .maybeSingle();

  if (error) {
    console.error("V2_LP_LOOKUP_ERROR:", error);
    return null;
  }

  return data as V2Page | null;
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page || !page.v2_cards?.v2_businesses) {
    notFound();
  }

  const business = page.v2_cards.v2_businesses;
  const title = page.title || business.business_name;
  const headline = page.headline || "Bagaimana pengalaman Anda hari ini?";
  const description = page.description || "Bantu kami memberikan pengalaman yang lebih baik.";
  const reviewUrl = business.google_review_url;
  const primary = page.primary_color || "#102b24";
  const secondary = page.secondary_color || "#b96912";

  return (
    <main className="v2-lp" style={{ "--v2-primary": primary, "--v2-secondary": secondary } as React.CSSProperties}>
      <div className="v2-shell">
        <header className="v2-hero">
          <div className="v2-badge">
            {business.logo_url ? <img src={business.logo_url} alt="" /> : business.business_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="v2-eyebrow">TERIMA KASIH SUDAH BERKUNJUNG</div>
          <h1>{title}</h1>
          {business.address && <p className="v2-address">{business.address}</p>}
        </header>

        <section className="v2-intro">
          <h2>{headline}</h2>
          <p>{description}</p>
        </section>

        <section className="v2-actions">
          {page.review_enabled && reviewUrl && (
            <a className="v2-action review" href={reviewUrl} target="_blank" rel="noopener noreferrer">
              <span className="icon">★</span>
              <span><b>Tulis Review di Google</b><small>Bagikan pengalaman Anda</small></span>
              <span className="arrow">→</span>
            </a>
          )}

          {page.feedback_enabled && (
            <a className="v2-action feedback" href={`/lp/${page.lp_slug}/feedback`}>
              <span className="icon">♥</span>
              <span><b>Kirim Feedback</b><small>Sampaikan pendapat Anda langsung ke kami</small></span>
              <span className="arrow">→</span>
            </a>
          )}

          {page.complaint_enabled && (
            <a className="v2-action complaint" href={`/lp/${page.lp_slug}/complaint`}>
              <span className="icon">✓</span>
              <span><b>Sampaikan Keluhan</b><small>Ada kendala? Kami siap menanganinya</small></span>
              <span className="arrow">→</span>
            </a>
          )}
        </section>

        <footer className="v2-footer">Powered by <b>Ulasan Toko V2</b> · {page.lp_slug}</footer>
      </div>

      <style>{`
        *{box-sizing:border-box}body{margin:0}.v2-lp{min-height:100vh;padding:18px 14px 40px;background:radial-gradient(circle at top,#fffaf3 0%,#f3f6f4 48%,#e9efec 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d2925}.v2-shell{max-width:540px;margin:0 auto;background:rgba(255,255,255,.96);border-radius:30px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.09)}.v2-hero{padding:46px 28px 28px;text-align:center;background:linear-gradient(150deg,var(--v2-primary),#244a3e);color:#fff}.v2-badge{width:78px;height:78px;margin:0 auto 18px;border-radius:22px;background:#fff;color:var(--v2-primary);display:grid;place-items:center;font-size:28px;font-weight:900;box-shadow:0 10px 30px rgba(0,0,0,.18);overflow:hidden}.v2-badge img{width:100%;height:100%;object-fit:cover}.v2-eyebrow{font-size:10px;letter-spacing:2px;font-weight:800;opacity:.72;margin-bottom:10px}.v2-hero h1{margin:0;font-size:30px;line-height:1.16;letter-spacing:-.7px}.v2-address{margin:12px auto 0;max-width:420px;font-size:12px;line-height:1.5;opacity:.72}.v2-intro{text-align:center;padding:30px 28px 20px}.v2-intro h2{margin:0 0 8px;font-size:20px;letter-spacing:-.2px}.v2-intro p{margin:0;color:#7b8580;font-size:14px;line-height:1.6}.v2-actions{padding:0 18px 18px;display:grid;gap:12px}.v2-action{display:grid;grid-template-columns:46px 1fr 22px;gap:13px;align-items:center;padding:15px;border-radius:20px;text-decoration:none;border:1px solid #e8ecea;box-shadow:0 5px 18px rgba(0,0,0,.035);transition:transform .15s ease}.v2-action:hover{transform:translateY(-1px)}.v2-action .icon{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;font-weight:900}.v2-action b{display:block;font-size:14px;color:#26312d;margin-bottom:3px}.v2-action small{display:block;color:#8a938f;font-size:11px;line-height:1.45}.v2-action .arrow{font-size:18px;color:#8d9692;text-align:right}.review{background:#fff8ef}.review .icon{background:#f6e5d1;color:var(--v2-secondary)}.feedback{background:#f4faf7}.feedback .icon{background:#e2f0e9;color:var(--v2-primary)}.complaint{background:#f4f6f5}.complaint .icon{background:#e5ebe8;color:var(--v2-primary)}.v2-footer{text-align:center;padding:18px;color:#a0a8a4;font-size:10px}.v2-footer b{color:#69736e}@media(max-width:420px){.v2-lp{padding:0}.v2-shell{min-height:100vh;border-radius:0}.v2-hero{padding-top:40px}}
      `}</style>
    </main>
  );
}
