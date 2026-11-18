/**
 * Shared presentation contract for browser preview and server-side finalized HTML.
 * The N5 template is preserved, while quote-specific timestamps and a transparent
 * forecast summary are added outside its original revenue calculations.
 */
import {renderExistingN5Proposal} from "./n5-proposal-renderer.mjs";
import {SECTIONS,pricingIssues} from "./quote-editor-core.mjs";
const dollars=n=>"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const escape=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const zone=d=>new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",timeZoneName:"short",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(d));
export function quotePayload(d){
 const payload=structuredClone(d.current_payload);
 payload.section_1_static??={};
 payload.section_1_static.Hwk_Id=payload.section_1_static.Hwk_Id||d.hwk_id;
 for(const section of SECTIONS){
  payload[section]=(payload[section]||[]).map(row=>{
   if(!row.custom)return row;
   const cadence={per_event:"Per monthly forecast event",recurring:"Monthly",one_time:"One-time"};
   const details=[row.billing_unit?"Per "+row.billing_unit:"",cadence[row.billing_frequency]||"",row.assumption||""].filter(Boolean).join(" · ");
   return {...row,field_name:row.display_label||row.field_name,assumption:details};
  });
 }
 return payload;
}
export function renderQuoteDocument(d,revision,{issuedAt=null,disableActions=true}={}){
 const issues=pricingIssues(d);
 const original=renderExistingN5Proposal(quotePayload(d));
 if(!original||!original.rounded_rate_revenue||!original.html_body)throw Error("N5 proposal renderer did not return full output");
 const figures=original.rounded_rate_revenue;
 const monthlyOperational=Number(figures.total_variable_revenue);
 if(!Number.isFinite(monthlyOperational))throw Error("Operational forecast was not calculated");
 const fees=d.custom_items.map(it=>{
  const row=d.current_payload[it.section]?.find(r=>r.field_name===it.id);
  const q=row?.forecast_quantity;
  return {name:it.description,rate:Number(row?.cost),quantity:q==null?null:Number(q),billing_unit:it.unit,frequency:it.frequency};
 });
 const projected=fees.filter(f=>f.quantity!==null);
 const monthlyOther=projected.filter(f=>f.frequency!=="one_time").reduce((n,x)=>n+x.rate*x.quantity,0);
 const oneTime=projected.filter(f=>f.frequency==="one_time").reduce((n,x)=>n+x.rate*x.quantity,0);
 const rppDenom=Number(d.current_payload.section_1_static?.storage_pallet_equivalent);
 const rpp=rppDenom>0?Math.round(monthlyOperational/rppDenom*100)/100:null;
 const generatedAt=d.generated_at||d.baseline_payload?.generated_at||new Date().toISOString();
 const stamp=issuedAt||null;
 const title=stamp?"FINALIZED RATE CARD":"DRAFT PREVIEW — NOT ISSUED";
 const metadata='<div style="margin-top:10px;font:700 11px Arial,sans-serif;color:#475569;line-height:1.7">'
   +escape(title)+' · Revision '+escape(revision)+'<br>Generated: '+escape(zone(generatedAt))
   +(stamp?'<br>Finalized: '+escape(zone(stamp))+'<br>Valid through: '+escape(zone(new Date(Date.parse(stamp)+30*86400000).toISOString())):"")
   +'</div>';
 let html=original.html_body.replace(/(REF ID:[\s\S]*?<\/div>)/, "$1"+metadata);
 if(html===original.html_body)throw Error("Could not locate N5 proposal reference header");
 const projection=fees.length?'<div style="margin-top:14px;font-size:12px">'+fees.map(f=>'<div style="padding:6px 0;border-bottom:1px solid #ddd">'
   +escape(f.name)+' · '+escape(f.billing_unit)+' · '+escape(f.frequency)+' · '+dollars(f.rate)
   +(f.quantity===null?' · forecast not supplied':' × '+escape(f.quantity)+' = '+dollars(f.rate*f.quantity))+'</div>').join("")+'</div>':"";
 const summary='<div style="margin-bottom:45px;border-left:6px solid #FF4B01;padding:14px;background:#ffffff;border-top:2px solid #1A202C;border-right:2px solid #1A202C;border-bottom:2px solid #1A202C">'
   +'<h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:1.5px;color:#1A202C">Projected Charges &amp; Quote Summary</h2>'
   +'<p style="font-size:12px">Modeled monthly inbound, storage &amp; outbound: <strong>'+dollars(monthlyOperational)+'</strong></p>'
   +'<p style="font-size:12px">Additional custom monthly / event fees: <strong>'+dollars(monthlyOther)+'</strong></p>'
   +'<p style="font-size:14px"><strong>Projected monthly subtotal: '+dollars(monthlyOperational+monthlyOther)+'</strong></p>'
   +'<p style="font-size:12px">One-time custom charges: <strong>'+dollars(oneTime)+'</strong></p>'
   +'<p style="font-size:11px;color:#475569">As-needed service rates and contractual minimums are not automatically added to monthly forecast revenue unless modeled. Operational RPP excludes administrative and custom charges.</p>'
   +projection+'</div>';
 const guardrail="\n        <div\n            style=\"\n                margin-top:55px;";
 if(!html.includes(guardrail))throw Error("Could not locate N5 proposal guardrail section");
 html=html.replace(guardrail,"\n        "+summary+guardrail);
 if(disableActions){
  // N5 includes a LIVE 'Let's Move Forward' webhook. It must be unusable in
  // an unsent preview or staging presentation to avoid accidental CRM writes.
  html=html.replace(/<a(\s)/g,"<span$1").replace(/<\/a>/g,"</span>")
    .replace(/\shref="[^"]*"/g,"");
 }
 return {html_body:html,monthlyOperational,monthlyOther,oneTime,monthlyTotal:Math.round((monthlyOperational+monthlyOther)*100)/100,projectedRpp:rpp,issues,generatedAt,issuedAt:stamp};
}
