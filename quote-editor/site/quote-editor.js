import {SECTIONS,newDraft,changeRate,resetRate,addLine,removeLine,targetRpp,preview} from "./quote-editor-core.mjs";
const $=id=>document.getElementById(id),sectionLabels={section_2_inbound_rows:"Inbound",section_3_storage_rows:"Storage",section_4_outbound_rows:"Outbound",section_5_misc_rows:"Miscellaneous / VAS"};
const fmt=v=>v===null||v===undefined?"Not projected":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const apiOrigin="https://api.scapegoat3plwarehouserates.com"; // staging API is NOT deployed yet
let quote=null,rev=null,changes=[],busy=false,mode="locked",quoteId="",token="";
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
 wrapper.append(input,el("strong","money",fmt(r.value)));
 const buttons=el("div");const custom=Boolean(r.custom),overridden=Boolean(quote.manual_overrides[r.section+":"+r.field_name]);
 if(custom||overridden){const b=el("button","alt",custom?"Remove":"Reset");b.type="button";b.style.padding="5px 8px";b.style.fontSize="12px";b.addEventListener("click",()=>{try{if(custom)staged({type:"remove_line",id:r.field_name},removeLine(quote,r.field_name),"Custom charge removed.");else staged({type:"reset_rate",section:r.section,field_name:r.field_name},resetRate(quote,r.section,r.field_name),"Generated rate restored.");}catch(e){notice(e.message)}});buttons.append(b)}
 wrapper.append(buttons);return wrapper;
}
function render(){
 $("mode").textContent=mode==="demo"?"LOCAL DEMO · NO SERVER":"SECURE EDITOR · DRAFT";
 $("title").textContent=quote?.hwk_id||"SECURE RATE CARD";
 $("revision").textContent=quote?"Revision "+rev+" · "+changes.length+" unsaved change(s)":"Open from your quote email";
 $("target").value=quote?.requested_target_rpp??"";
 $("target").disabled=!quote||busy;$("add").disabled=!quote||busy;
 $("save").disabled=mode!=="live"||!quote||busy||changes.length===0;
 $("reload").hidden=mode!=="live";
 $("publish").disabled=true;
 const wrap=$("sections");wrap.replaceChildren();
 if(!quote){wrap.append(el("p","sub","No rate card loaded. Open an authorized link or add ?demo=1 to the URL for a synthetic demonstration."));return}
 const p=preview(quote);
 $("achieved").textContent=p.rpp===null?"Not projected":fmt(p.rpp);
 $("monthly").textContent=p.unknown?"Incomplete":fmt(p.monthly);
 $("oneTime").textContent=p.unknown?"Incomplete":fmt(p.oneTime);
 $("forecast").textContent=p.unknown?p.unknown+" rate lines have no forecast quantity. Totals are incomplete.":"Illustrative estimates only; N3 reconciliation required.";
 for(const section of SECTIONS){
 const box=el("section","rates"),heading=el("h2","",sectionLabels[section]);box.append(heading);
 const head=el("div","line line-head");
 for(const title of ["Service","Billing unit","Rate","Est. value",""])head.append(el("span","",title));box.append(head);
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
const query=new URLSearchParams(location.search);quoteId=query.get("quote_id")||"";
const fragment=new URLSearchParams(location.hash.slice(1));const supplied=fragment.get("access_token");
if(supplied&&uuid.test(quoteId)){sessionStorage.setItem("scapegoat_quote_token:"+quoteId,supplied);history.replaceState(null,"",location.pathname+location.search)}
if(uuid.test(quoteId))token=sessionStorage.getItem("scapegoat_quote_token:"+quoteId)||"";
if(token&&uuid.test(quoteId)){mode="live";load()}
else if(query.get("demo")==="1"){
 mode="demo";const baseline_payload={section_1_static:{Warehouse_rpp:50,storage_pallet_equivalent:100},section_2_inbound_rows:[{field_name:"inbound_container_min",display_label:"Container Unload",cost:850,billing_unit:"container",forecast_quantity:2,billing_frequency:"per_event",assumption:"Per floor-loaded container"}],section_3_storage_rows:[{field_name:"storage_pallet_base",display_label:"Pallet Storage",cost:20,billing_unit:"pallet/month",forecast_quantity:100,billing_frequency:"recurring"}],section_4_outbound_rows:[{field_name:"b2b_pallet_out",display_label:"Outbound Pallet",cost:13,billing_unit:"pallet",forecast_quantity:100,billing_frequency:"per_event"}],section_5_misc_rows:[]};
 quote=newDraft({quote_id:"DEMO",hwk_id:"HWK-DEMO",warehouse_id:"DEMO",baseline_payload});rev=1;
 notice("Synthetic demo: edit rates and add fees. No data is saved or sent.",true);render();
}else render();
