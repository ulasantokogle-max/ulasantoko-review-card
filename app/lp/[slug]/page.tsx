import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type FeedbackPage = {
  id: string;
  page_code: string;
  slug: string;
  business_name: string;
  google_review_url: string | null;
  template_key: string | null;
  industry: string | null;

  review_title: string | null;
  review_description: string | null;

  complaint_title: string | null;
  complaint_description: string | null;

  is_active: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

async function getFeedbackPage(slug: string): Promise<FeedbackPage | null> {
  const { data, error } = await supabase
    .from("feedback_pages")
    .select(`
      id,
      page_code,
      slug,
      business_name,
      google_review_url,
      template_key,
      industry,
      review_title,
      review_description,
      complaint_title,
      complaint_description,
      is_active
    `)
    .or(`slug.eq.${slug},page_code.eq.${slug}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("GET_FEEDBACK_PAGE_ERROR:", error);
    return null;
  }

  return data;
}

function getIndustryLabel(industry: string | null) {
  switch (industry) {
    case "food_beverage":
      return "Tempat usaha";

    case "hotel":
      return "Hotel & Hospitality";

    case "salon":
      return "Salon & Beauty";

    case "clinic":
      return "Layanan kesehatan";

    case "retail":
      return "Toko & Retail";

    case "automotive":
      return "Otomotif";

    case "service":
      return "Layanan";

    default:
      return "Bisnis";
  }
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await getFeedbackPage(slug);

  if (!page) {
    notFound();
  }

  const reviewTitle =
    page.review_title || "Bagikan Pengalaman Anda";

  const reviewDescription =
    page.review_description ||
    "Bantu bisnis kami berkembang dengan memberikan ulasan di Google Maps.";

  const complaintTitle =
    page.complaint_title || "Hubungi Layanan Pelanggan";

  const complaintDescription =
    page.complaint_description ||
    "Ada kendala atau pengalaman yang kurang menyenangkan? Sampaikan kepada kami agar dapat segera ditangani.";

  const industryLabel = getIndustryLabel(page.industry);

  return (
    <main className="lp-page">
      <div className="lp-container">

        {/* TOP DECORATION */}
        <div className="lp-top-decoration">
          <div className="lp-decoration-shape shape-one" />
          <div className="lp-decoration-shape shape-two" />
          <div className="lp-decoration-shape shape-three" />
        </div>

        {/* BUSINESS IDENTITY */}
        <section className="lp-header">

          <div className="lp-logo">
            {page.business_name
              .split(" ")
              .slice(0, 2)
              .map((word) => word.charAt(0).toUpperCase())
              .join("")}
          </div>

          <div className="lp-eyebrow">
            TERIMA KASIH SUDAH BERKUNJUNG
          </div>

          <h1>{page.business_name}</h1>

          <div className="lp-line" />

          <p className="lp-industry">
            {industryLabel}
          </p>

        </section>

        {/* INTRO */}
        <section className="lp-intro">

          <h2>
            Bagaimana pengalaman Anda hari ini?
          </h2>

          <p>
            Kami selalu ingin memberikan
            pengalaman terbaik untuk Anda.
          </p>

        </section>

        {/* REVIEW CARD */}
        <section className="lp-card review-card">

          <div className="lp-card-icon review-icon">
            <span>★</span>
          </div>

          <div className="lp-card-content">

            <h3>{reviewTitle}</h3>

            <p>{reviewDescription}</p>

            {page.google_review_url ? (
              <a
                href={page.google_review_url}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-button review-button"
              >
                <span className="google-icon">
                  G
                </span>

                <span>
                  Tulis Review di Google Maps
                </span>

                <span className="arrow">
                  →
                </span>
              </a>
            ) : (
              <div className="lp-disabled-button">
                Link Google Review belum tersedia
              </div>
            )}

          </div>

        </section>

        {/* COMPLAINT CARD */}
        <section className="lp-card complaint-card">

          <div className="lp-card-icon complaint-icon">
            <span>✓</span>
          </div>

          <div className="lp-card-content">

            <h3>{complaintTitle}</h3>

            <p>{complaintDescription}</p>

            <a
              href={`/lp/${page.slug}/complaint`}
              className="lp-button complaint-button"
            >
              <span className="message-icon">
                □
              </span>

              <span>
                Sampaikan Keluhan
              </span>

              <span className="arrow">
                →
              </span>
            </a>

          </div>

        </section>

        {/* FOOTER */}
        <footer className="lp-footer">

          <span>
            Powered by
          </span>

          <strong>
            Ulasan Toko
          </strong>

        </footer>

      </div>

      {/* PAGE STYLE */}
      <style>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f4f6f5;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .lp-page {
          min-height: 100vh;
          padding: 24px 16px 50px;
          background:
            radial-gradient(
              circle at top,
              #fffaf3 0%,
              #f4f6f5 48%,
              #edf1ef 100%
            );
        }

        .lp-container {
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          background: rgba(255,255,255,.96);
          border-radius: 30px;
          overflow: hidden;
          box-shadow:
            0 20px 60px rgba(0,0,0,.08);
        }

        .lp-top-decoration {
          position: relative;
          height: 92px;
          overflow: hidden;
          background:
            linear-gradient(
              135deg,
              #19332c,
              #284b40
            );
        }

        .lp-decoration-shape {
          position: absolute;
          border-radius: 50%;
          opacity: .16;
          background: #d98a24;
        }

        .shape-one {
          width: 190px;
          height: 190px;
          right: -50px;
          top: -110px;
        }

        .shape-two {
          width: 130px;
          height: 130px;
          left: -50px;
          bottom: -95px;
        }

        .shape-three {
          width: 90px;
          height: 90px;
          right: 100px;
          top: 20px;
        }

        .lp-header {
          text-align: center;
          padding: 0 28px;
          margin-top: -40px;
          position: relative;
        }

        .lp-logo {
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 22px;
          background: #fff;
          color: #19332c;
          font-size: 23px;
          font-weight: 800;
          letter-spacing: -1px;
          box-shadow:
            0 8px 25px rgba(0,0,0,.13);
        }

        .lp-eyebrow {
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: 700;
          color: #9a6728;
          margin-bottom: 10px;
        }

        .lp-header h1 {
          margin: 0;
          color: #17221f;
          font-size: 29px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -.7px;
        }

        .lp-line {
          width: 45px;
          height: 4px;
          border-radius: 99px;
          background: #b96912;
          margin: 18px auto 10px;
        }

        .lp-industry {
          margin: 0;
          color: #8b928f;
          font-size: 13px;
        }

        .lp-intro {
          text-align: center;
          padding: 30px 28px 22px;
        }

        .lp-intro h2 {
          margin: 0 0 10px;
          color: #27312e;
          font-size: 20px;
          font-weight: 750;
        }

        .lp-intro p {
          margin: 0;
          color: #8b928f;
          font-size: 14px;
          line-height: 1.6;
        }

        .lp-card {
          margin: 0 20px 14px;
          padding: 18px;
          display: flex;
          gap: 15px;
          border-radius: 23px;
        }

        .review-card {
          background: #fff7ee;
          border: 1px solid #f4e8d9;
        }

        .complaint-card {
          background: #f1f5f4;
          border: 1px solid #e4ebe8;
        }

        .lp-card-icon {
          flex: 0 0 47px;
          width: 47px;
          height: 47px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 800;
        }

        .review-icon {
          background: #f8e8d5;
          color: #b96912;
        }

        .complaint-icon {
          background: #e5ece9;
          color: #19332c;
        }

        .lp-card-content {
          min-width: 0;
          flex: 1;
        }

        .lp-card-content h3 {
          margin: 2px 0 5px;
          color: #29322f;
          font-size: 15px;
          font-weight: 750;
        }

        .lp-card-content p {
          margin: 0 0 14px;
          color: #8a918e;
          font-size: 12px;
          line-height: 1.5;
        }

        .lp-button {
          width: 100%;
          min-height: 46px;
          padding: 10px 14px;
          border-radius: 99px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
          font-size: 12px;
          font-weight: 750;
          transition:
            transform .15s ease,
            box-shadow .15s ease;
        }

        .lp-button:active {
          transform: scale(.98);
        }

        .review-button {
          color: #fff;
          background:
            linear-gradient(
              135deg,
              #b95f06,
              #d8780c
            );
          box-shadow:
            0 7px 18px rgba(185,95,6,.18);
        }

        .complaint-button {
          color: #fff;
          background: #102b24;
          box-shadow:
            0 7px 18px rgba(16,43,36,.15);
        }

        .google-icon {
          width: 19px;
          height: 19px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fff;
          color: #4285f4;
          font-size: 12px;
          font-weight: 900;
        }

        .message-icon {
          font-size: 14px;
        }

        .arrow {
          margin-left: auto;
          font-size: 17px;
        }

        .lp-disabled-button {
          padding: 12px;
          border-radius: 99px;
          text-align: center;
          font-size: 11px;
          color: #999;
          background: #eee;
        }

        .lp-footer {
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          color: #a2a8a5;
          font-size: 10px;
        }

        .lp-footer strong {
          color: #6f7773;
        }

        @media (max-width: 400px) {

          .lp-page {
            padding: 0;
          }

          .lp-container {
            min-height: 100vh;
            border-radius: 0;
          }

          .lp-header h1 {
            font-size: 26px;
          }

          .lp-card {
            margin-left: 14px;
            margin-right: 14px;
          }

        }

      `}</style>
    </main>
  );
}
