// One-time, public URL diagnostic. No secrets, PINs, or database access.
// This script is safe to remove after troubleshooting V1 Google Maps links.
const url = "https://maps.app.goo.gl/9QxANuCdbfTxQnr66";
(async () => {
  let current = url;
  for (let i = 0; i < 6; i++) {
    const parsed = new URL(current);
    if (!["maps.app.goo.gl","www.google.com","google.com","maps.google.com","search.google.com"].includes(parsed.hostname) || parsed.protocol !== "https:") {
      console.log("blocked redirect host", parsed.hostname); break;
    }
    console.log("HOP", i, "host", parsed.hostname, "pathname", parsed.pathname.slice(0,240), "params", [...parsed.searchParams.keys()]);
    try {
      const response = await fetch(current,{redirect:"manual",signal:AbortSignal.timeout(9000),headers:{"User-Agent":"Mozilla/5.0"}});
      console.log("STATUS",response.status,"TYPE",response.headers.get("content-type"));
      const location=response.headers.get("location");
      if(location){current=new URL(location,current).toString();continue;}
      if ((response.headers.get("content-type")||"").includes("text/html")) {
        const body=(await response.text()).slice(0,100000);
        for (const pattern of [/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i, /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i, /<meta[^>]+http-equiv="refresh"[^>]+content="([^"]+)"/i, /"(https?:\\/\\/[^"]+maps[^"]+)"/i]) {
          const match=body.match(pattern);
          if(match) console.log("HTML_METADATA",match[1].slice(0,250));
        }
        console.log("HTML_TITLE",body.match(/<title>([^<]{0,200})<\/title>/i)?.[1]||"absent");
      }
      break;
    } catch(error) {console.log("FETCH_ERROR",error.name, String(error.cause?.code||error.message).slice(0,180));break;}
  }
})().catch(e=>{console.log("DIAG_ERROR",String(e));});
