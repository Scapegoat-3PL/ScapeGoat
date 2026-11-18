import {SECTIONS,newDraft,changeRate,resetRate,addLine,removeLine,targetRpp,preview,changeQuantity,pricingIssues,getForecastQuantity} from "./quote-editor-core.mjs";
import {renderExistingN5Proposal} from "./n5-proposal-renderer.mjs";
import {renderQuoteDocument} from "./quote-release.mjs";
const $=id=>document.getElementById(id),sectionLabels={section_2_inbound_rows:"Inbound",section_3_storage_rows:"Storage",section_4_outbound_rows:"Outbound",section_5_misc_rows:"Miscellaneous / VAS"};
const fmt=v=>v===null||v===undefined?"Not projected":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const apiOrigin=location.origin; // Cloudflare Worker routes /api/* on this same preview origin
let quote=null,rev=null,changes=[],busy=false,mode="locked",quoteId="",token="";
const stamp=when=>when?new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Los_Angeles",timeZoneName:"short"}).format(new Date(when)):"Not recorded";
function notice(t,good=false){$("notice").textContent=t;$("notice").className="notice"+(good?" good":"")}
function staged(op,next,msg){quote=next;changes.push(op);notice(msg);render()}
function lineView(r){
 const wrapper=el("div","line");const desc=el("div","desc");
 desc.append(el("strong","",r.display_label||r.field_name.replaceAll("_"," ")));
 if(r.assumption)desc.append(el("small","",r.assumption));
 if(quote.manual_overrides[r.section+":"+r.field_name])desc.append(el("span","tag","NEGOTIATED RATE"));
 if(r.custom)desc.append(el("span","tag","CUSTOM ITEM"));
 wrapper.append(desc,el("span","sub",r.billing_unit||"Per service"));
 const input=el("input");input.type="number";input.min="0";input.step=".01";input.value=r.cost;input.disabled=busy;
 input.setAttribute("aria-label","Rate for "+(r.display_label||r.field_name));
 input.addEventListener("change",()=>{try{staged({type:"edit_rate",section:r.section,field_name:r.field_name,rate:input.value},changeRate(quote,r.section,r.field_name,input.value),"Only this rate changed; no RPP redistribution.");}catch(e){notice(e.message);render()}});
 const q=el("input");q.type="number";q.min="0";q.step=".01";q.placeholder="As needed";q.value=r.forecast_quantity??"";
 q.disabled=busy;q.setAttribute("aria-label","Monthly forecast quantity for "+(r.display_label||r.field_name));
 q.title=r.quantity_source==="opportunity"?"Forecast derived from this opportunity. Changing it updates related volumes.":"Monthly forecast units; enter 0 if not forecast.";
 q.addEventListener("change",()=>{if(q.value===""){notice("Enter a forecast quantity or 0 for none. Existing source volumes are preserved.");return}
 try{staged({type:"edit_quantity",section:r.section,field_name:r.field_name,quantity:q.value},changeQuantity(quote,r.section,r.field_name,q.value),"Forecast quantity updated for this opportunity. Related service volumes may also change.");}catch(e){notice(e.message);render()}}); 
 wrapper.append(input,q,el("strong","money",r.value===null?"—":fmt(r.value)));
 const buttons=el("div");const custom=Boolean(r.custom),overridden=Boolean(quote.manual_overrides[r.section+":"+r.field_name]);
 if(custom||overridden){const b=el("button","alt",custom?"Remove":"Reset");b.type="button";b.style.padding="5px 8px";b.style.fontSize="12px";b.addEventListener("click",()=>{try{if(custom)staged({type:"remove_line",id:r.field_name},removeLine(quote,r.field_name),"Custom charge removed.");else staged({type:"reset_rate",section:r.section,field_name:r.field_name},resetRate(quote,r.section,r.field_name),"Generated rate restored.");}catch(e){notice(e.message)}});buttons.append(b)}
 wrapper.append(buttons);return wrapper;
}
function render(){
 $("mode").textContent=mode==="demo"?"LOCAL DEMO · NO SERVER":"SECURE EDITOR · DRAFT";
 $("title").textContent=quote?.hwk_id||"SECURE RATE CARD";
 $("revision").textContent=quote?"Revision "+rev+" · "+changes.length+" unsaved change(s)":"Open from your quote email";
 $("timeInfo").textContent=quote?"Generated "+stamp(quote.generated_at||quote.baseline_payload?.generated_at||quote.baseline_payload?.section_1_static?.generated_at)+" · "+(quote.finalized_at?"Finalized "+stamp(quote.finalized_at):"Draft"):"";
 $("target").value=quote?.requested_target_rpp??"";
 $("target").disabled=!quote||busy;$("add").disabled=!quote||busy;
 $("preview").disabled=!quote||busy;
 $("save").disabled=mode!=="live"||!quote||busy||changes.length===0;
 $("reload").hidden=mode!=="live";
 $("publish").disabled=!quote||busy||quote.status!=="draft"||changes.length>0&&mode==="live"||pricingIssues(quote).length>0;
 const wrap=$("sections");wrap.replaceChildren();
 if(!quote){wrap.append(el("p","sub","No rate card loaded. Open an authorized link or add ?demo=1 to the URL for a synthetic demonstration."));return}
 const p=preview(quote);
 let modeled=null;
 try {modeled=renderQuoteDocument(quote,rev);}catch(error){console.warn("Quote preview needs validation:",error.message)}
 const peq=Number(quote.current_payload.section_1_static?.storage_pallet_equivalent)||0;
 const operational=modeled?.monthlyOperational;
 const customMonth=modeled?.monthlyOther??0;
 const customOnce=modeled?.oneTime??0;
 $("achieved").textContent=operational!==undefined&&peq>0?fmt(Math.round(operational/peq*100)/100):"Not projected";
 $("monthly").textContent=operational!==undefined?fmt(operational+customMonth):"Not projected";
 $("oneTime").textContent=fmt(customOnce);
 const issues=pricingIssues(quote);
 $("forecast").textContent=issues.length?issues.join(" · "):"Operating forecast uses the original N5 calculation. BOL volume comes from outbound shipments. Custom recurring charges are shown separately; N3 target changes still require optimization.";
 for(const section of SECTIONS){
 const box=el("section","rates"),heading=el("h2","",sectionLabels[section]);box.append(heading);
 const head=el("div","line line-head");
 for(const title of ["Service","Billing unit","Rate","Forecast qty","Est. line value",""])head.append(el("span","",title));box.append(head);
 for(const r of p.rows.filter(r=>r.section===section))box.append(lineView(r));
 wrap.append(box);
 }
}
async function api(path,method="GET",body=null){
 const response=await fetch(apiOrigin+path,{method,mode:"cors",cache:"no-store",headers:{"Authorization":"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({error:"API returned an invalid response"}));
 if(!response.ok)throw Error(data.error||"HTTP "+response.status);return data;
}
async function load(){
 if(mode!=="live")return;busy=true;render();notice("Loading secure quote...");
 try{const result=await api("/api/quotes/"+encodeURIComponent(quoteId));quote=result.draft;rev=result.revision;changes=[];notice("Quote loaded. All edits are limited to this opportunity.",true)}
 catch(e){quote=null;notice("Unable to load: "+e.message)}
 busy=false;render();
}
$("rppForm").addEventListener("submit",e=>{e.preventDefault();if(!quote||busy)return;try{const r=$("target").value;staged({type:"set_target_rpp",rpp:r},targetRpp(quote,r),"Target recorded. N3 repricing is required before this quote can be sent.");}catch(err){notice(err.message)}});
$("add").addEventListener("click",()=>$("addDialog").showModal());
$("cancel").addEventListener("click",()=>$("addDialog").close());
$("addForm").addEventListener("submit",e=>{
 e.preventDefault();if(!quote||busy)return;
 const section={inbound:SECTIONS[0],storage:SECTIONS[1],outbound:SECTIONS[2],misc:SECTIONS[3]}[$("category").value];
 const op={type:"add_line",id:"custom_"+crypto.randomUUID().replaceAll("-",""),section,description:$("name").value,unit:$("unit").value,rate:$("rate").value,quantity:$("quantity").value===""?null:Number($("quantity").value),frequency:$("frequency").value,assumption:$("assumption").value};
 try{staged(op,addLine(quote,op),"Custom charge added only to this opportunity.");e.currentTarget.reset();$("addDialog").close()}catch(err){notice(err.message)}
});
$("reload").addEventListener("click",()=>{if(changes.length&&!confirm("Discard unsaved changes?"))return;load()});
$("save").addEventListener("click",async()=>{
 if(mode!=="live"||busy||!changes.length)return;
 busy=true;render();notice("Saving revised draft...");
 try{const result=await api("/api/quotes/"+quoteId,"PATCH",{expected_revision:rev,operations:changes});quote=result.draft;rev=result.revision;changes=[];notice("Revision saved. No customer email was sent.",true)}
 catch(e){notice("Save failed: "+e.message+". Keep this tab open; your changes are not saved.")}
 busy=false;render();
});

function proposalPayload(draft){
 const payload=structuredClone(draft.current_payload);
 payload.section_1_static=payload.section_1_static||{};
 payload.section_1_static.Hwk_Id=payload.section_1_static.Hwk_Id||draft.hwk_id;
 // N5 prints field_name for the service title. Preserve custom internal IDs in
 // the editor database but use the human-readable title for the N5 presentation.
 for(const section of SECTIONS){
  payload[section]=(payload[section]||[]).map(row=>{
   if(!row.custom)return row;
   const cadence={per_event:"Per event",recurring:"Monthly recurring",one_time:"One-time"};
   const billing=row.billing_unit?"Per "+row.billing_unit:"";
   const details=[billing,cadence[row.billing_frequency]||"",row.assumption||""].filter(Boolean).join(" · ");
   return {...row,field_name:row.display_label||row.field_name,assumption:details};
  });
 }
 return payload;
}
function openRateCardPreview(){
 if(!quote||busy)return;
 try{
  const output=renderQuoteDocument(quote,rev);
  if(!output||typeof output.html_body!=="string")throw Error("N5 returned no proposal");
  // The ORIGINAL N5 template includes a live 'Let's Move Forward' webhook.
  // Remove all actions in the preview ONLY; do not change N5's layout.
  const doc=new DOMParser().parseFromString(output.html_body,"text/html");
  doc.querySelectorAll("script,form").forEach(node=>node.remove());
  doc.querySelectorAll("a").forEach(node=>{
   node.removeAttribute("href");node.style.pointerEvents="none";
   node.setAttribute("title","Disabled in quote preview");
  });
  doc.querySelectorAll("*").forEach(node=>{
   for(const attr of [...node.attributes]){
    if(/^on/i.test(attr.name))node.removeAttribute(attr.name);
   }
  });
  $("previewFrame").srcdoc="<!doctype html>\n"+doc.documentElement.outerHTML;
  const messages=["Original N5 email layout, showing current edited rates and opportunity-derived quantities. Links are disabled; no email is sent."];
  if(quote.reprice_requested)messages.push("Target RPP was changed, but N3 has NOT redistributed charges. Do not send this quote until recalculated.");
  if(quote.custom_items?.length)messages.push("Custom charges display in the Administrative & Misc section. Monthly recurring custom fees are separate from operational RPP.");
  if(quote.calculation_status==="needs_reconciliation"&&quote.reprice_requested)messages.push("Draft awaits N3 RPP optimization.");
  $("previewDetails").textContent=messages.join(" ");
  $("previewDialog").showModal();
 }catch(err){notice("Unable to render the N5 preview: "+err.message);}
}
$("preview").addEventListener("click",openRateCardPreview);
$("closePreview").addEventListener("click",()=>$("previewDialog").close());


function finalizedPresentationHtml(){
 const n5=renderQuoteDocument(quote,rev,{issuedAt:quote.finalized_at||new Date().toISOString()});
 const doc=new DOMParser().parseFromString(n5.html_body,"text/html");
 doc.querySelectorAll("script,form").forEach(node=>node.remove());
 doc.querySelectorAll("a").forEach(node=>{node.removeAttribute("href");node.style.pointerEvents="none";});
 doc.querySelectorAll("*").forEach(node=>{for(const attr of [...node.attributes])if(/^on/i.test(attr.name))node.removeAttribute(attr.name)});
 return "<!doctype html>\n"+doc.documentElement.outerHTML;
}
function exportPresentation(download=true){
 const blob=new Blob([finalizedPresentationHtml()],{type:"text/html;charset=utf-8"});
 const href=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=href;
 if(download){a.download="Scapegoat-Rate-Card-"+String(quote.hwk_id).replace(/[^a-z0-9-]/gi,"-")+"-Rev"+rev+".html";a.click();}
 else{a.target="_blank";a.rel="noopener";a.click();}
 setTimeout(()=>URL.revokeObjectURL(href),30000);
}
$("publish").addEventListener("click",()=>{
 if(!quote||busy)return;
 if(changes.length&&mode==="live"){notice("Save your changes before finalizing.");return}
 const issues=pricingIssues(quote);if(issues.length){notice(issues.join(" · "));return}
 $("finalizeSummary").textContent="Opportunity "+quote.hwk_id+" · Revision "+rev+" · Generated "+stamp(quote.generated_at)+" · All finalizations are time-stamped.";
 $("deliveryMethod").value="presentation";$("deliveryMethod").dispatchEvent(new Event("change"));
 $("finalizeDialog").showModal();
});
$("cancelFinalize").addEventListener("click",()=>$("finalizeDialog").close());
$("deliveryMethod").addEventListener("change",()=>{
 const destination=$("deliveryMethod").value;
 const candidate=destination==="customer"?quote?.current_payload?.section_1_static?.lead_email:destination==="warehouse"?quote?.current_payload?.section_1_static?.warehouse_email:null;
 $("recipientLabel").hidden=destination==="presentation";
 $("recipientName").textContent=destination==="customer"?"Verified customer email":"Verified warehouse email";
 $("recipient").value=candidate||"";
 $("deliveryWarning").textContent=destination==="presentation"
 ? "You can finalize a local demo and download a presentation copy. Live finalization requires the backend staging API."
 : "Email delivery is not connected yet. Only verified opportunity recipients may be used, and no message will be sent from this demo.";
 $("confirmFinalize").disabled=destination!=="presentation";
});
$("confirmFinalize").addEventListener("click",async()=>{
 if(!quote||busy||$("deliveryMethod").value!=="presentation")return;
 if(mode==="demo"){
  quote.status="finalized";quote.finalized_at=new Date().toISOString();
  $("finalizeDialog").close();notice("Demo rate card finalized at "+stamp(quote.finalized_at)+". Downloading a presentation copy; no email sent.",true);
  render();exportPresentation(true);return;
 }
 // Production-grade finalization must be server-committed, timestamped and read-only.
 // The staging API is intentionally gated until the authorization and N3 checks are complete.
 busy=true;render();try{
  const result=await api("/api/quotes/"+encodeURIComponent(quoteId)+"/finalize","POST",{expected_revision:rev,delivery_method:"presentation"});
  quote=result.draft;rev=result.revision;$("finalizeDialog").close();
  notice("Rate card finalized and timestamped; downloading presentation copy. No email sent.",true);
  exportPresentation(true);
 }catch(e){notice("Finalization was not completed: "+e.message);}
 busy=false;render();
});

const query=new URLSearchParams(location.search);quoteId=query.get("quote_id")||"";
const fragment=new URLSearchParams(location.hash.slice(1));const supplied=fragment.get("access_token");
if(supplied&&uuid.test(quoteId)){sessionStorage.setItem("scapegoat_quote_token:"+quoteId,supplied);history.replaceState(null,"",location.pathname+location.search)}
if(uuid.test(quoteId))token=sessionStorage.getItem("scapegoat_quote_token:"+quoteId)||"";
if(token&&uuid.test(quoteId)){mode="live";load()}
else if(query.get("demo")==="1"){
 mode="demo";const baseline_payload={section_1_static:{Warehouse_rpp:50,storage_pallet_equivalent:100},section_2_inbound_rows:[{field_name:"inbound_container_min",display_label:"Container Unload",cost:850,billing_unit:"container",forecast_quantity:2,billing_frequency:"per_event",assumption:"Per floor-loaded container"}],section_3_storage_rows:[{field_name:"storage_pallet_base",display_label:"Pallet Storage",cost:20,billing_unit:"pallet/month",forecast_quantity:100,billing_frequency:"recurring"}],section_4_outbound_rows:[{field_name:"b2b_pallet_out",display_label:"Outbound Pallet",cost:13,billing_unit:"pallet",forecast_quantity:100,billing_frequency:"per_event"}],section_5_misc_rows:[]};
 baseline_payload.section_1_static={...baseline_payload.section_1_static,Hwk_Id:"HWK-DEMO",selected_warehouse_name:"Sample Warehouse Partner",city:"Los Angeles",state:"CA"};
 baseline_payload.section_2_inbound={inbound_type:"Floor-loaded",has_pallet_in:false,has_container_unload:true,container_avg_inbound_qty_per_month:2,container_avg_qty_per_inbound:500,Master_Carton_In:0.68,inbound_container_min:850};
 baseline_payload.section_2_inbound_rows.unshift({field_name:"master_carton_in",cost:0.68,assumption:"Carton handling"});
 baseline_payload.section_3_storage={storage_type:"Pallet",Storage_Qty:100,storage_pallet_equivalent:100,storage_pallet_base:20};
 baseline_payload.section_4_outbound={DTC:{dtc_vol:0},B2B:{retail_vol:0},PalletOut:{pallet_vol:10,pallets_per_order:10,b2b_pallet_out:13,bol_fee:8}};
 baseline_payload.section_4_outbound_rows.push({field_name:"bol_fee",cost:8,assumption:"Per outbound shipment"});
 baseline_payload.section_5_misc={monthly_minimum:1000};
 quote=newDraft({quote_id:"DEMO",hwk_id:"HWK-DEMO",warehouse_id:"DEMO",baseline_payload});quote.generated_at=new Date().toISOString();rev=1;
 notice("Synthetic demo: edit rates and add fees. No data is saved or sent.",true);render();
}else render();
