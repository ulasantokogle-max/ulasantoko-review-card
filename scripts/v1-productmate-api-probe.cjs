const maps_url = "https://maps.app.goo.gl/9QxANuCdbfTxQnr66";
async function test(input) {
  try {
    const response = await fetch("https://productmate.com/api/v1/google-review-link",{
      method:"POST",headers:{"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify({maps_url:input}),signal:AbortSignal.timeout(14000),redirect:"manual",
    });
    const body=await response.text();
    console.log("Productmate status:",response.status);
    console.log("Content type:",response.headers.get("content-type"));
    try { const obj=JSON.parse(body); console.log("Fields:",JSON.stringify({
      place_id:obj.place_id??null,review_url:obj.review_url??null,
      verification:obj.verification??null,error:obj.error??null,
      message:obj.message??null,
    })); }catch {console.log("Non-json response prefix:",body.slice(0,180));}
  }catch(e){console.log("Request failed:",e.name, e.cause?.code||e.message);}
}
test(maps_url);
