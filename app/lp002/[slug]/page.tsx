import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import LP002 from "@/components/lp/lp002";

type Page = {
  id: string;
  page_code: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  google_review_url: string | null;
  industry: string | null;
  review_title: string | null;
  review_description: string | null;
  complaint_title: string | null;
  complaint_description: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function LP002Preview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data, error } = await supabase
    .from("feedback_pages")
    .select(`
      id,
      page_code,
      slug,
      business_name,
      logo_url,
      cover_url,
      primary_color,
      secondary_color,
      google_review_url,
      industry,
      review_title,
      review_description,
      complaint_title,
      complaint_description
    `)
    .or(`slug.eq.${slug},page_code.eq.${slug}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return <LP002 page={data as Page} />;
}
