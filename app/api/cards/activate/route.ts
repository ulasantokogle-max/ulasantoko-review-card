import {NextResponse} from "next/server";
import {supabaseServer} from "@/lib/supabase";
export async function POST(req:Request){
  try{
    const body=await req.json();
    const cardCode=String(body.cardCode||"").trim();
    const businessName=String(body.businessName||"").trim();
    const reviewUrl=String(body.reviewUrl||"").trim();
    if(!cardCode||!businessName||!reviewUrl) return NextResponse.json({error:"Semua field wajib diisi."},{status:400});
    try{new URL(reviewUrl)}catch{return NextResponse.json({error:"Link Google Review tidak valid."},{status:400})}
    const db=supabaseServer();
    const {data:existing,error:findError}=await db.from("cards").select("*").eq("card_code",cardCode).maybeSingle();
    if(findError) throw findError;
    if(existing?.status==="active") return NextResponse.json({error:"Kartu ini sudah aktif."},{status:409});
    const payload={card_code:cardCode,business_name:businessName,google_review_url:reviewUrl,status:"active",activated_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const result=existing?await db.from("cards").update(payload).eq("id",existing.id).select().single():await db.from("cards").insert(payload).select().single();
    if(result.error) throw result.error;
    return NextResponse.json({ok:true,card:result.data});
  }catch(error:any){return NextResponse.json({error:error.message||"Server error"},{status:500})}
}