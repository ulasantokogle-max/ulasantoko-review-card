// Public read-only production smoke test. Does not access PIN or database.
const url = "https://app.ulasantoko.space/r-v1/ULAS-00206";
const expected = "https://search.google.com/local/writereview?placeid=ChIJ0zTGG8mRaS4R-Wq3wTTcDZ0";
(async () => {
 const res = await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(12000),headers:{"User-Agent":"V1-redirect-smoke-test"}});
 const location = res.headers.get("location");
 console.log("HTTP:",res.status,"Location:",location,"Cache-Control:",res.headers.get("cache-control"));
 if(res.status!==307) throw new Error("V1 card redirect did not return HTTP 307");
 if(location!==expected) throw new Error("V1 card redirect target differs from verified Google Review URL");
 console.log("PASS: active V1 card redirects to exact Google Review destination");
})().catch(e=>{console.error("FAIL:",e.message);process.exitCode=1;});
