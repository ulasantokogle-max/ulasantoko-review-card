import { NextRequest, NextResponse } from "next/server";
import { isProviderAuthenticated } from "@/lib/v1-provider-auth";
import { v1SupabaseServer, hasDedicatedV1Database } from "@/lib/v1-supabase";
import { getV1RateLimitStatus } from "@/lib/v1-rate-limit";
import { officialV1DirectReviewUrl, resolveV1GooglePlaceId, resolveV1GoogleReviewCandidate } from "@/lib/v1-google-maps";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"no-store, private"};

export async function POST(request: NextRequest) {
  if (!isProviderAuthenticated(request)) return NextResponse.json({message:"Login Provider V1 diperlukan."},{status:401,headers});
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return NextResponse.json({message:"Asal permintaan tidak valid."},{status:403,headers});
  if (!hasDedicatedV1Database()) return NextResponse.json({message:"Database V1 belum tersedia."},{status:503,headers});
  let mapsUrl: string, businessName: string;
  try {
    const body = await request.json();
    mapsUrl = typeof body?.maps_url === "string" ? body.maps_url.trim() : "";
    businessName = typeof body?.business_name === "string" ? body.business_name.trim() : "";
    const u = new URL(mapsUrl);
    const allowed = ["maps.app.goo.gl","www.google.com","google.com","maps.google.com","search.google.com"];
    if (mapsUrl.length > 2048 || u.protocol !== "https:" || !allowed.includes(u.hostname) ||
        u.username || u.password || u.port || businessName.length < 4 || businessName.length > 180)
      return NextResponse.json({message:"Masukkan URL Google Maps HTTPS dan nama bisnis yang valid."},{status:400,headers});
  } catch {
    return NextResponse.json({message:"Data URL tidak valid."},{status:400,headers});
  }
  try {
    const limited = await getV1RateLimitStatus(v1SupabaseServer(), request, "create");
    if (limited !== "allowed") return NextResponse.json({
      message:limited === "limited" ? "Batas pemeriksaan tercapai. Coba lagi nanti." : "Layanan batas permintaan tidak tersedia."
    },{status:limited === "limited" ? 429 : 503,headers});
    const official = officialV1DirectReviewUrl(mapsUrl);
    if (official) return NextResponse.json({
      status:"direct", name:businessName, review_url:official,
      message:"Link ini sudah berupa tautan ulasan resmi. Tidak perlu pencarian Places."
    },{headers});
    try {
      const placeId = await resolveV1GooglePlaceId(mapsUrl);
      return NextResponse.json({
        status:"resolved", review_url:"https://search.google.com/local/writereview?placeid="+encodeURIComponent(placeId),
        message:"Place ID terbaca langsung dari URL Google. Pastikan tujuan ulasannya benar."
      },{headers});
    } catch { /* Only try Places if no explicit Place ID can be read */ }
    const resolution = await resolveV1GoogleReviewCandidate(mapsUrl,businessName);
    const candidate = resolution.candidate;
    if (!candidate) return NextResponse.json({
      reason: resolution.reason,
      google_check: resolution.google,
      fallback_check: resolution.fallback,
      status:"unresolved",
      message:process.env.V1_GOOGLE_PLACES_API_KEY
        ? "Google Places tidak menemukan satu kandidat yang cukup pasti. Periksa nama bisnis, alamat dan API Google Places."
        : "API key Google Places khusus V1 belum tersedia."
    },{headers});
    return NextResponse.json({
      status:candidate.verified ? "resolved" : "confirm",
      source: resolution.source,
      google_check: resolution.google,
      fallback_check: resolution.fallback,
      candidate: {name:candidate.name,address:candidate.address,verified:candidate.verified},
      review_url:"https://search.google.com/local/writereview?placeid="+encodeURIComponent(candidate.placeId),
      message:candidate.verified
        ? "Nama dan alamat berhasil dicocokkan secara otomatis. Periksa tujuan link ulasan."
        : "Kandidat ditemukan. Wajib cocokkan nama dan alamat secara manual sebelum aktivasi."
    },{headers});
  } catch (error) {
    console.error("V1_PROVIDER_MAPS_CHECK_ERROR",error instanceof Error ? error.name : "unknown");
    return NextResponse.json({status:"unresolved",message:"Pemeriksaan Google Places gagal. Coba lagi atau periksa log V1."},{status:503,headers});
  }
}
