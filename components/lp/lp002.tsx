type LP002Page = {
  id: string;
  page_code: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  google_review_url: string | null;
  review_title: string | null;
  review_description: string | null;
  complaint_title: string | null;
  complaint_description: string | null;
  industry: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function industryLabel(industry: string | null) {
  const labels: Record<string, string> = {
    food_beverage: "Tempat Usaha",
    hotel: "Hotel & Hospitality",
    salon: "Salon & Beauty",
    clinic: "Layanan Kesehatan",
    retail: "Toko & Retail",
    automotive: "Otomotif",
    service: "Layanan",
  };

  return labels[industry || ""] || "Bisnis";
}

export default function LP002({
  page,
  complaintHref,
}: {
  page: LP002Page;
  complaintHref?: string | null;
}) {
  const primary = page.primary_color || "#173A32";
  const secondary = page.secondary_color || "#D49A3A";
  const reviewTitle = page.review_title || "Bagaimana pengalaman Anda?";
  const reviewDescription =
    page.review_description ||
    "Bagikan pengalaman Anda melalui Google. Ulasan Anda sangat berarti bagi kami.";
  const complaintTitle = page.complaint_title || "Ada kendala?";
  const complaintDescription =
    page.complaint_description ||
    "Sampaikan kendala atau masukan langsung kepada tim kami.";

  return (
    <main className="lp002-page" style={{ "--lp-primary": primary, "--lp-secondary": secondary } as React.CSSProperties}>
      <div className="lp002-shell">
        <header className="lp002-hero">
          {page.cover_url && (
            <img className="lp002-cover" src={page.cover_url} alt="" />
          )}
          <div className="lp002-overlay" />

          <div className="lp002-brand">
            <div className="lp002-logo">
              {page.logo_url ? (
                <img src={page.logo_url} alt={page.business_name} />
              ) : (
                initials(page.business_name)
              )}
            </div>
            <div>
              <p className="lp002-kicker">ULASAN TOKO</p>
              <h1>{page.business_name}</h1>
              <p className="lp002-industry">{industryLabel(page.industry)}</p>
            </div>
          </div>
        </header>

        <section className="lp002-intro">
          <span className="lp002-pill">TERIMA KASIH SUDAH BERKUNJUNG</span>
          <h2>Pengalaman Anda berarti bagi kami.</h2>
          <p>
            Pilih cara yang paling nyaman untuk menyampaikan pengalaman Anda.
          </p>
        </section>

        <section className="lp002-actions">
          <article className="lp002-action lp002-review">
            <div className="lp002-icon">★</div>
            <div className="lp002-copy">
              <span className="lp002-label">GOOGLE REVIEW</span>
              <h3>{reviewTitle}</h3>
              <p>{reviewDescription}</p>
              {page.google_review_url ? (
                <a href={page.google_review_url} target="_blank" rel="noopener noreferrer" className="lp002-button lp002-review-button">
                  <span>Tulis Review di Google</span>
                  <span>↗</span>
                </a>
              ) : (
                <div className="lp002-disabled">Link Google Review belum tersedia</div>
              )}
            </div>
          </article>

          {complaintHref && (
            <article className="lp002-action lp002-complaint">
              <div className="lp002-icon">✓</div>
              <div className="lp002-copy">
                <span className="lp002-label">CUSTOMER CARE</span>
                <h3>{complaintTitle}</h3>
                <p>{complaintDescription}</p>
                <a href={complaintHref} className="lp002-button lp002-complaint-button">
                  <span>Sampaikan Keluhan</span>
                  <span>→</span>
                </a>
              </div>
            </article>
          )}
        </section>

        <footer className="lp002-footer">
          <span>Powered by</span> <strong>Ulasan Toko</strong>
        </footer>
      </div>

      <style>{`
        .lp002-page{min-height:100vh;padding:20px 14px 44px;background:#f4f6f4;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18231f}
        .lp002-shell{width:100%;max-width:520px;margin:0 auto;background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 22px 70px rgba(19,40,34,.10)}
        .lp002-hero{position:relative;min-height:218px;background:var(--lp-primary);overflow:hidden}
        .lp002-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .lp002-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,30,25,.18),rgba(10,30,25,.88))}
        .lp002-brand{position:absolute;left:24px;right:24px;bottom:22px;display:flex;align-items:center;gap:15px;color:#fff}
        .lp002-logo{width:70px;height:70px;flex:0 0 70px;border-radius:20px;background:#fff;color:var(--lp-primary);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,.18)}
        .lp002-logo img{width:100%;height:100%;object-fit:cover}
        .lp002-kicker{margin:0 0 4px;font-size:9px;letter-spacing:2px;font-weight:800;color:var(--lp-secondary)}
        .lp002-brand h1{margin:0;font-size:25px;line-height:1.15;letter-spacing:-.5px;font-weight:850}
        .lp002-industry{margin:5px 0 0;color:rgba(255,255,255,.72);font-size:12px}
        .lp002-intro{text-align:center;padding:28px 26px 18px}
        .lp002-pill{display:inline-block;padding:7px 11px;border-radius:999px;background:#f6efe4;color:#8c6227;font-size:9px;font-weight:800;letter-spacing:1.3px}
        .lp002-intro h2{margin:15px 0 7px;font-size:22px;line-height:1.2;letter-spacing:-.4px}
        .lp002-intro p{margin:0;color:#7c8580;font-size:13px;line-height:1.6}
        .lp002-actions{padding:4px 16px 12px;display:grid;gap:13px}
        .lp002-action{display:flex;gap:14px;padding:18px;border-radius:22px;border:1px solid #e8ece9}
        .lp002-review{background:#fff9f1;border-color:#f1e4d2}
        .lp002-complaint{background:#f4f7f6}
        .lp002-icon{width:48px;height:48px;flex:0 0 48px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;background:#f4e6d2;color:#a96d17}
        .lp002-complaint .lp002-icon{background:#e2ece8;color:var(--lp-primary)}
        .lp002-copy{min-width:0;flex:1}
        .lp002-label{display:block;margin:1px 0 5px;font-size:9px;letter-spacing:1.3px;font-weight:850;color:#9a8a75}
        .lp002-complaint .lp002-label{color:#71847c}
        .lp002-copy h3{margin:0;color:#26312d;font-size:16px;font-weight:800}
        .lp002-copy p{margin:6px 0 14px;color:#7c8580;font-size:12px;line-height:1.55}
        .lp002-button{min-height:45px;padding:10px 14px;border-radius:13px;display:flex;align-items:center;justify-content:space-between;text-decoration:none;font-size:12px;font-weight:800}
        .lp002-review-button{background:var(--lp-secondary);color:#fff;box-shadow:0 7px 18px rgba(180,125,40,.16)}
        .lp002-complaint-button{background:var(--lp-primary);color:#fff;box-shadow:0 7px 18px rgba(23,58,50,.13)}
        .lp002-disabled{padding:11px;border-radius:13px;text-align:center;background:#ecefed;color:#9aa19e;font-size:10px}
        .lp002-footer{text-align:center;padding:18px 24px 25px;color:#a0a8a4;font-size:10px}.lp002-footer strong{color:#6f7874}
        @media(max-width:400px){.lp002-page{padding:0}.lp002-shell{min-height:100vh;border-radius:0}.lp002-brand{left:18px;right:18px}.lp002-actions{padding-left:12px;padding-right:12px}}
      `}</style>
    </main>
  );
}
