/**
 * Cloudflare Worker — Scapegoat opportunity-specific quote revisions.
 * STAGING ONLY. No publish, email, rate-card master writes, or production workflow calls.
 * REQUIRED secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_API_KEY
 * REQUIRED var: EDITOR_ORIGIN (exact authorized static website origin)
 * Deployment is intentionally separate from the existing root website.
 */
import {newDraft,operations,pricingIssues,SECTIONS} from "../quote-editor-core.mjs";
import {renderQuoteDocument} from "../quote-release.mjs";
import {repriceQuote} from "../n3-reprice.mjs";
import {resolveVerifiedRecipients,resolveDeliveryDestination} from "../recipient-verification.mjs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const enc=new TextEncoder();
const sha=async x=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(x))),b=>b.toString(16).padStart(2,"0")).join("");
const token=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
function equal(a,b){if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function json(body,status=200,origin=""){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer",...(origin?{"access-control-allow-origin":origin,"vary":"Origin"}:{})}})}
async function bodyJson(req){const raw=await req.text();if(raw.length>220000)throw Error("Request too large");const value=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Expected JSON object");return value}
async function db(env,method,table,query="",body=null,prefer=null){
 const url=env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+table+(query?"?"+query:"");
 const response=await fetch(url,{method,headers:{"apikey":env.SUPABASE_SERVICE_ROLE_KEY,"authorization":"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,"content-type":"application/json",...(prefer?{"prefer":prefer}:{})},...(body===null?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error("Database error "+response.status);
 return data;
}
async function authorization(env,id,req){
 const match=/^Bearer ([a-zA-Z0-9_-]{40,200})$/.exec(req.headers.get("authorization")||"");
 if(!match)return null;
 const digest=await sha(match[1]);
 const matches=await db(env,"GET","sg_opportunity_rate_quote_links","select=link_id,quote_id,expires_at,revoked_at&token_hash=eq."+digest+"&limit=1");
 const found=matches?.[0];
 if(!found||found.quote_id!==id||found.revoked_at||Date.parse(found.expires_at)<=Date.now())return null;
 return found;
}
async function trustedRecipients(env,hwkId,warehouseId){
 // Never authorize either channel without an exact source lead assignment.
 // An existing warehouse email alone is not sufficient.
 const warehouses=await db(env,"GET","warehouses",
   "select=warehouse_id,warehouse_email,warehouse_name&warehouse_id=eq."+encodeURIComponent(warehouseId)+"&limit=1");
 const rows=[];
 for(const table of ["VacancyChain","Hawkish"]){
   const matches=await db(env,"GET",table,
     "select=lead_id,warehouse_id,lead_email,email&lead_id=eq."+encodeURIComponent(hwkId)+"&limit=30");
   rows.push(...(matches||[]));
 }
 return resolveVerifiedRecipients({
   hwkId,warehouseId,warehouse:warehouses?.[0]||null,sourceRows:rows
 });
}
function checkBaseline(payload){
 if(!payload||typeof payload!=="object"||Array.isArray(payload)||!payload.section_1_static)throw Error("Missing quote sections");
 for(const s of SECTIONS)if(!Array.isArray(payload[s]))throw Error("Missing "+s);
 if(JSON.stringify(payload).length>150000)throw Error("Payload too large");
}
export default {async fetch(req,env){
 const url=new URL(req.url),origin=req.headers.get("origin")||"",allowed=origin===env.EDITOR_ORIGIN?origin:"";
 if(origin&&!allowed)return json({error:"Origin denied"},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":allowed,"access-control-allow-methods":"GET,POST,PATCH,OPTIONS","access-control-allow-headers":"Authorization, Content-Type, X-Internal-API-Key","access-control-max-age":"600","vary":"Origin"}});
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.INTERNAL_API_KEY||!env.EDITOR_ORIGIN)return json({error:"Not configured"},503,allowed);
 if(url.pathname==="/health"&&req.method==="GET")return json({ok:true,status:"staging"},200,allowed);
 try{
  if(url.pathname==="/api/internal/quotes"&&req.method==="POST"){
   if(!equal(req.headers.get("x-internal-api-key")||req.headers.get("apikey")||"",env.INTERNAL_API_KEY))return json({error:"Unauthorized"},401,allowed);
   const input=await bodyJson(req),id=crypto.randomUUID();
   if(typeof input.hwk_id!=="string"||input.hwk_id.length<4||input.hwk_id.length>100||!UUID.test(input.warehouse_id||""))return json({error:"Invalid opportunity identity"},422,allowed);
   checkBaseline(input.baseline_payload);
   // Production gate: verify HWK-to-warehouse association against authoritative lead/engagement records upstream.
   // This staging API is internal-only and must not be exposed to untrusted workflows.
   const warehouse=await db(env,"GET","warehouses","select=warehouse_id&warehouse_id=eq."+input.warehouse_id+"&limit=1");
   if(!warehouse?.length)return json({error:"Unknown warehouse"},422,allowed);
   const access=token(),expires=new Date(Date.now()+14*86400000).toISOString();
   const draft=newDraft({quote_id:id,hwk_id:input.hwk_id,warehouse_id:input.warehouse_id,baseline_payload:input.baseline_payload});
   await db(env,"POST","sg_opportunity_rate_quotes","",{quote_id:id,hwk_id:input.hwk_id,warehouse_id:input.warehouse_id,revision:1,status:"draft",baseline_payload:input.baseline_payload,draft_payload:draft,editor_source:"n8n-generator"},"return=minimal");
   await db(env,"POST","sg_opportunity_rate_quote_links","",{quote_id:id,token_hash:await sha(access),expires_at:expires},"return=minimal");
   // A token is returned only to the privileged generator; do not send or log it publicly.
   const link=env.EDITOR_ORIGIN+"/?quote_id="+encodeURIComponent(id)+"#access_token="+encodeURIComponent(access);
   return json({quote_id:id,edit_url:link,expires_at:expires},201,allowed);
  }
  const match=/^\/api\/quotes\/([0-9a-f-]{36})(\/finalize|\/deliver|\/reprice)?$/i.exec(url.pathname);
  if(!match||!UUID.test(match[1]))return json({error:"Not found"},404,allowed);
  const id=match[1],link=await authorization(env,id,req);if(!link)return json({error:"Invalid or expired edit link"},401,allowed);
  const quotes=await db(env,"GET","sg_opportunity_rate_quotes","select=quote_id,hwk_id,warehouse_id,revision,status,draft_payload,updated_at,created_at,finalized_at,final_html&quote_id=eq."+id+"&limit=1");
  const stored=quotes?.[0];if(!stored)return json({error:"Quote not found"},404,allowed);
  // Warehouse and customer addresses are optional suggested defaults.
  // The quote-scoped bearer token plus explicit manual email confirmation
  // authorizes delivery; contact records must not prevent a chosen recipient.
  let recipientStatus=null;
  if(env.ENABLE_EMAIL_DELIVERY==="true"){
   try{recipientStatus=await trustedRecipients(env,stored.hwk_id,stored.warehouse_id)}
   catch(_err){recipientStatus=null}
  }
  const output=q=>({quote_id:q.quote_id,hwk_id:q.hwk_id,revision:q.revision,status:q.status,draft:q.draft_payload,created_at:q.created_at,updated_at:q.updated_at,finalized_at:q.finalized_at,delivery_enabled:env.ENABLE_EMAIL_DELIVERY==="true",delivery_recipients:recipientStatus?.verified===true?recipientStatus:null,delivery_reasons:null,...(q.status==="finalized"?{final_html:q.final_html}:{})});
  if(match[2]==="/reprice"){
   if(req.method!=="POST")return json({error:"Method not allowed"},405,allowed);
   if(stored.status!=="draft")return json({error:"Only drafts may be repriced"},409,allowed);
   const requestBody=await bodyJson(req);
   if(!Number.isInteger(requestBody.expected_revision)||requestBody.expected_revision!==stored.revision)
     return json({error:"Revision conflict: reload before changing Target RPP"},409,allowed);
   let next;
   try{next=repriceQuote(stored.draft_payload,requestBody.target_rpp)}
   catch(err){return json({error:"RPP recalculation failed: "+err.message},422,allowed)}
   if(!next.reprice_result||!Number.isFinite(next.reprice_result.achieved_rpp))
     return json({error:"N3 did not reconcile the resulting rate card"},422,allowed);
   const updated=await db(env,"PATCH","sg_opportunity_rate_quotes",
    "quote_id=eq."+id+"&revision=eq."+stored.revision+"&status=eq.draft&select=quote_id,hwk_id,warehouse_id,revision,status,draft_payload,updated_at,created_at,finalized_at,final_html",
    {revision:stored.revision+1,draft_payload:next,editor_source:"n3-reprice:"+link.link_id},
    "return=representation");
   if(!updated?.length)return json({error:"Concurrent edit: reload before repricing"},409,allowed);
   return json({...output(updated[0]),reprice_result:next.reprice_result},200,allowed);
  }
  if(match[2]==="/deliver"){
   if(req.method!=="POST")return json({error:"Method not allowed"},405,allowed);
   // Aria polls the restricted pending-delivery table with existing Supabase
   // credentials. No webhook key or new paid infrastructure.
   if(env.ENABLE_EMAIL_DELIVERY!=="true")
    return json({error:"Aria delivery queue is not yet enabled"},503,allowed);
   if(stored.status!=="finalized"||!stored.final_html||!stored.finalized_at)
    return json({error:"Finalize this revision before requesting delivery"},409,allowed);
   const body=await bodyJson(req);
   if(!["customer","warehouse"].includes(body.channel)||body.to||body.recipient)
    return json({error:"Select a verified customer or warehouse delivery channel"},422,allowed);
   if(body.expected_revision!==stored.revision)return json({error:"Revision conflict"},409,allowed);
   // The verified CRM address is advisory. The bearer link is the
   // authorization for this finalized rate-card revision.
   const recipients=recipientStatus;
   let email,recipientSource;
   try{
     ({email,recipientSource}=resolveDeliveryDestination({
       channel:body.channel,
       recipientEmail:body.recipient_email,
       recipientConfirmed:body.recipient_confirmed,
       verifiedRecipients:recipients
     }));
   }catch(err){return json({error:err.message},422,allowed)}
   const deliveryId=crypto.randomUUID();
   let inserted;
   try{
    inserted=await db(env,"POST","sg_opportunity_rate_quote_deliveries",
     "on_conflict=quote_id,revision,channel&select=delivery_id,status,requested_at",
     {delivery_id:deliveryId,quote_id:id,revision:stored.revision,channel:body.channel,
      recipient_email:email,recipient_source:recipientSource,recipient_confirmed_at:new Date().toISOString(),status:"pending"},
     "resolution=ignore-duplicates,return=representation");
   }catch(e){return json({error:"Could not queue delivery"},503,allowed)}
   if(!inserted?.length)
     return json({error:"This rate card revision has already been queued or sent to that channel"},409,allowed);
   return json({delivery_id:deliveryId,delivery_status:"pending",message:"Queued for Aria; not yet confirmed sent."},202,allowed);
  }
  if(match[2]==="/finalize"){
   if(req.method!=="POST")return json({error:"Method not allowed"},405,allowed);
   if(env.ENABLE_FINALIZATION!=="true")return json({error:"Server-side finalization is not enabled for this environment"},503,allowed);
   if(stored.status!=="draft")return json({error:"Rate card has already been finalized or is not editable"},409,allowed);
   const requestBody=await bodyJson(req);
   if(requestBody.delivery_method!=="presentation")return json({error:"Email delivery is not yet enabled. Use presentation copy."},422,allowed);
   if(!Number.isInteger(requestBody.expected_revision)||requestBody.expected_revision!==stored.revision)return json({error:"Revision conflict: reload before finalizing"},409,allowed);
   const issues=pricingIssues(stored.draft_payload);
   if(issues.length)return json({error:"Cannot finalize: "+issues.join("; ")},422,allowed);
   // Render and reconcile using the same N5 code as the preview, on the server.
   // Ignore any client-supplied HTML or financial totals.
   const issuedAt=new Date().toISOString();
   const next=structuredClone(stored.draft_payload);
   next.status="finalized";next.finalized_at=issuedAt;next.issued_revision=stored.revision+1;
   let prepared;
   try{prepared=renderQuoteDocument(next,stored.revision+1,{issuedAt,disableActions:true})}
   catch(error){return json({error:"N5 reconciliation failed; cannot finalize"},422,allowed)}
   if(prepared.issues.length||!Number.isFinite(prepared.monthlyTotal))return json({error:"Pricing needs reconciliation"},422,allowed);
   next.reconciled_totals={operational:prepared.monthlyOperational,custom_monthly:prepared.monthlyOther,projected_monthly:prepared.monthlyTotal,one_time:prepared.oneTime,rpp:prepared.projectedRpp};
   next.calculation_status="n5_reconciled";
   const updated=await db(env,"PATCH","sg_opportunity_rate_quotes",
    "quote_id=eq."+id+"&revision=eq."+stored.revision+"&status=eq.draft&select=quote_id,hwk_id,warehouse_id,revision,status,draft_payload,updated_at,created_at,finalized_at,final_html",
    {revision:stored.revision+1,status:"finalized",draft_payload:next,finalized_at:issuedAt,final_html:prepared.html_body,editor_source:"finalize:present:"+link.link_id},"return=representation");
   if(!updated?.length)return json({error:"Concurrent edit: reload before finalization"},409,allowed);
   return json(output(updated[0]),200,allowed);
  }
  if(req.method==="GET")return json(output(stored),200,allowed);
  if(req.method!=="PATCH")return json({error:"Method not allowed"},405,allowed);
  if(stored.status!=="draft")return json({error:"Quote is not an editable draft"},409,allowed);
  const payload=await bodyJson(req);
  if(!Number.isInteger(payload.expected_revision)||payload.expected_revision!==stored.revision)return json({error:"Revision conflict: reload the quote"},409,allowed);
  let edited;
  try{
   edited=operations(stored.draft_payload,payload.operations);
   // Legacy PATCH clients may still submit set_target_rpp; they must not leave
   // a stored quote permanently stuck in pending N3 state.
   if(edited.reprice_requested)edited=repriceQuote(edited,edited.requested_target_rpp);
  }catch(e){return json({error:e.message},422,allowed)}
  if(SECTIONS.reduce((n,s)=>n+(edited.current_payload[s]?.length||0),0)>150)return json({error:"Too many line items"},422,allowed);
  const updated=await db(env,"PATCH","sg_opportunity_rate_quotes","quote_id=eq."+id+"&revision=eq."+stored.revision+"&select=quote_id,hwk_id,warehouse_id,revision,status,draft_payload,updated_at",{revision:stored.revision+1,draft_payload:edited,editor_source:"edit-link:"+link.link_id},"return=representation");
  if(!updated?.length)return json({error:"Concurrent edit: reload the quote"},409,allowed);
  return json(output(updated[0]),200,allowed);
 }catch(e){
  const malformed=/JSON|Request|Expected|Payload|Missing/.test(e.message||"");
  return json({error:malformed?"Invalid request":"Internal API error"},malformed?400:500,allowed);
 }
}};
