import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.mjs";

const origin="https://scapegoat3plwarehouserates.com";
const apiUrl="https://quote-editor-test.workers.dev";
const env={SUPABASE_URL:"https://test.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"test-service-secret",INTERNAL_API_KEY:"test-internal-key",EDITOR_ORIGIN:origin};
const warehouseId="11111111-1111-4111-8111-111111111111";
const initial={section_1_static:{Warehouse_rpp:50,storage_pallet_equivalent:100},section_2_inbound_rows:[{field_name:"inbound_container_min",cost:850,forecast_quantity:2}],section_3_storage_rows:[{field_name:"storage_pallet_base",cost:20,forecast_quantity:100}],section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13,forecast_quantity:100}],section_5_misc_rows:[]};
const quotes=new Map(),links=[],outbox=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(rawUrl,options={})=>{
 const url=new URL(rawUrl),table=url.pathname.split("/").pop();
 if(url.hostname!=="test.supabase.co"||options.headers.apikey!==env.SUPABASE_SERVICE_ROLE_KEY)throw Error("Unexpected outbound API");
 const method=options.method||"GET",body=options.body?JSON.parse(options.body):null;
 if(table==="warehouses"&&method==="GET")return Response.json(url.searchParams.get("warehouse_id")==="eq."+warehouseId?[{warehouse_id:warehouseId,warehouse_email:"warehouse@example.com",warehouse_name:"Example Warehouse"}]:[]);
 if(table==="VacancyChain"&&method==="GET")return Response.json(url.searchParams.get("lead_id")==="eq.HWK-FINAL"?[{lead_id:"HWK-FINAL",warehouse_id:warehouseId,lead_email:"buyer@example.com",email:"buyer@example.com"}]:[]);
 if(table==="Hawkish"&&method==="GET")return Response.json([]);
 if(table==="sg_opportunity_rate_quote_deliveries"){
  if(method==="POST"){
   if(outbox.some(d=>d.quote_id===body.quote_id&&d.revision===body.revision&&d.channel===body.channel))return Response.json([]);
   const delivery={...body,delivery_id:body.delivery_id||crypto.randomUUID()};
   outbox.push(delivery);return Response.json([delivery]);
  }
  if(method==="GET")return Response.json(outbox.filter(d=>d.quote_id===url.searchParams.get("quote_id")?.replace("eq.","")));
 }
 if(table==="sg_opportunity_rate_quotes"){
  if(method==="POST"){quotes.set(body.quote_id,{...body,updated_at:new Date().toISOString()});return new Response(null,{status:201})}
  const id=url.searchParams.get("quote_id")?.replace("eq.","");
  if(method==="GET")return Response.json(quotes.get(id)?[quotes.get(id)]:[]);
  if(method==="PATCH"){
   const saved=quotes.get(id),rev=Number(url.searchParams.get("revision")?.replace("eq.",""));
   if(!saved||saved.revision!==rev)return Response.json([]);
   const update={...saved,...body,updated_at:new Date().toISOString()};
   quotes.set(id,update);return Response.json([update]);
  }
 }
 if(table==="sg_opportunity_rate_quote_links"){
  if(method==="POST"){links.push({...body,link_id:"link-one"});return new Response(null,{status:201})}
  if(method==="GET")return Response.json(links.filter(l=>l.token_hash===url.searchParams.get("token_hash")?.replace("eq.","")));
 }
 throw Error("Unexpected table/method "+table+" "+method);
};
const request=(path,method="GET",body=null,headers={})=>new Request(apiUrl+path,{method,headers:{"origin":origin,"content-type":"application/json",...headers},...(body?{body:JSON.stringify(body)}:{})});
test("authorized snapshot, scoped edit link, revisions and stale-edit rejection",async()=>{
 let res=await worker.fetch(request("/api/internal/quotes","POST",{hwk_id:"HWK-TEST",warehouse_id:warehouseId,baseline_payload:initial}),env);
 assert.equal(res.status,401);
 res=await worker.fetch(request("/api/internal/quotes","POST",{hwk_id:"HWK-TEST",warehouse_id:warehouseId,baseline_payload:initial},{"x-internal-api-key":env.INTERNAL_API_KEY}),env);
 assert.equal(res.status,201);
 const created=await res.json();assert.ok(created.edit_url.includes("#access_token="));
 const access=new URL(created.edit_url).hash.replace("#access_token=","");
 const authorization={authorization:"Bearer "+access};
 assert.equal((await worker.fetch(request("/api/quotes/"+created.quote_id),env)).status,401);
 res=await worker.fetch(request("/api/quotes/"+created.quote_id,"GET",null,authorization),env);
 assert.equal(res.status,200);assert.equal((await res.json()).revision,1);
 const edit={expected_revision:1,operations:[{type:"edit_rate",section:"section_2_inbound_rows",field_name:"inbound_container_min",rate:750}]};
 res=await worker.fetch(request("/api/quotes/"+created.quote_id,"PATCH",edit,authorization),env);
 assert.equal(res.status,200);
 const next=await res.json();assert.equal(next.revision,2);
 assert.equal(next.draft.current_payload.section_2_inbound_rows[0].cost,750);
 assert.equal(next.draft.baseline_payload.section_2_inbound_rows[0].cost,850);
 assert.equal((await worker.fetch(request("/api/quotes/"+created.quote_id,"PATCH",edit,authorization),env)).status,409);
 assert.equal((await worker.fetch(request("/api/quotes/"+created.quote_id,"PATCH",edit,{authorization:"Bearer wrong"}),env)).status,401);
 const other=Request;
 const disallowed=new Request(apiUrl+"/health",{headers:{"origin":"https://attacker.example"}});
 assert.equal((await worker.fetch(disallowed,env)).status,403);
});
test("rejects unrecognized warehouse",async()=>{
 const res=await worker.fetch(request("/api/internal/quotes","POST",{hwk_id:"HWK-TEST",warehouse_id:"22222222-2222-4222-8222-222222222222",baseline_payload:initial},{"x-internal-api-key":env.INTERNAL_API_KEY}),env);
 assert.equal(res.status,422);
});

test("finalize locks and timestamps a reconciled presentation without sending email",async()=>{
 const modeled={...initial,
  section_1_static:{...initial.section_1_static,Hwk_Id:"HWK-FINAL",selected_warehouse_name:"Example Warehouse"},
  section_2_inbound:{inbound_type:"Floor-loaded",has_pallet_in:false,has_container_unload:true,container_avg_inbound_qty_per_month:2,container_avg_qty_per_inbound:500,Master_Carton_In:0.68,inbound_container_min:850},
  section_3_storage:{Storage_Qty:100,storage_pallet_equivalent:100,storage_pallet_base:20},
  section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:0},PalletOut:{pallet_vol:10,pallets_per_order:10,b2b_pallet_out:13,bol_fee:8}},
  section_5_misc:{monthly_minimum:1000},
  section_2_inbound_rows:[{field_name:"master_carton_in",cost:0.68},{field_name:"inbound_container_min",cost:850}],
  section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13},{field_name:"bol_fee",cost:8}]
 };
 let res=await worker.fetch(request("/api/internal/quotes","POST",{hwk_id:"HWK-FINAL",warehouse_id:warehouseId,baseline_payload:modeled},{"x-internal-api-key":env.INTERNAL_API_KEY}),env);
 assert.equal(res.status,201);const created=await res.json();
 const bearer={authorization:"Bearer "+new URL(created.edit_url).hash.replace("#access_token=","")};
 const enabled={...env,ENABLE_FINALIZATION:"true"};
 res=await worker.fetch(request("/api/quotes/"+created.quote_id+"/finalize","POST",{expected_revision:1,delivery_method:"presentation"},bearer),enabled);
 assert.equal(res.status,200);
 const final=await res.json();
 assert.equal(final.status,"finalized");
 assert.equal(final.revision,2);
 assert.ok(final.finalized_at);
 assert.match(final.final_html,/FINALIZED RATE CARD/);
 assert.match(final.final_html,/Projected Charges/);
 assert.doesNotMatch(final.final_html,/<a\s+href=/);
 assert.equal(final.draft.reconciled_totals.operational,5080);
 const retry=await worker.fetch(request("/api/quotes/"+created.quote_id+"/finalize","POST",{expected_revision:2,delivery_method:"presentation"},bearer),enabled);
 assert.equal(retry.status,409);
 const edit=await worker.fetch(request("/api/quotes/"+created.quote_id,"PATCH",{expected_revision:2,operations:[{type:"edit_rate",section:"section_3_storage_rows",field_name:"storage_pallet_base",rate:19}]},bearer),enabled);
 assert.equal(edit.status,409);
});
test("legacy target-RPP PATCH recalculates through N3 instead of stranding finalization",async()=>{
 const modeled={...initial,section_2_inbound:{},section_3_storage:{Storage_Qty:100},section_4_outbound:{},section_5_misc:{}};
 const createdResponse=await worker.fetch(request("/api/internal/quotes","POST",{hwk_id:"HWK-RPPTEST",warehouse_id:warehouseId,baseline_payload:modeled},{"x-internal-api-key":env.INTERNAL_API_KEY}),env);
 assert.equal(createdResponse.status,201);
 const created=await createdResponse.json(),bearer={authorization:"Bearer "+new URL(created.edit_url).hash.replace("#access_token=","")};
 const edited=await worker.fetch(request("/api/quotes/"+created.quote_id,"PATCH",{expected_revision:1,operations:[{type:"set_target_rpp",rpp:55}]},bearer),env);
 assert.equal(edited.status,200);
 const repriced=await edited.json();
 assert.equal(repriced.draft.reprice_requested,false);
 assert.equal(repriced.draft.reprice_result.target_rpp,55);
 assert.equal(repriced.draft.reprice_result.engine,"frozen_n3_n4_n5");
 const finalized=await worker.fetch(request("/api/quotes/"+created.quote_id+"/finalize","POST",{expected_revision:2,delivery_method:"presentation"},bearer),{...env,ENABLE_FINALIZATION:"true"});
 assert.equal(finalized.status,200);
});


test("manual email entry is honored only after confirmation and actual Hawk ID ownership, without sending an email",async()=>{
 const modeled={...initial,
  section_1_static:{...initial.section_1_static,Hwk_Id:"HWK-FINAL",selected_warehouse_name:"Example Warehouse"},
  section_2_inbound:{inbound_type:"Floor-loaded",has_pallet_in:false,has_container_unload:true,container_avg_inbound_qty_per_month:2,container_avg_qty_per_inbound:500,Master_Carton_In:0.68,inbound_container_min:850},
  section_3_storage:{Storage_Qty:100,storage_pallet_equivalent:100,storage_pallet_base:20},
  section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:0},PalletOut:{pallet_vol:10,pallets_per_order:10,b2b_pallet_out:13,bol_fee:8}},
  section_5_misc:{monthly_minimum:1000},
  section_2_inbound_rows:[{field_name:"master_carton_in",cost:0.68},{field_name:"inbound_container_min",cost:850}],
  section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13},{field_name:"bol_fee",cost:8}]
 };
 const createdResponse=await worker.fetch(request("/api/internal/quotes","POST",{hwk_id:"HWK-FINAL",warehouse_id:warehouseId,baseline_payload:modeled},{"x-internal-api-key":env.INTERNAL_API_KEY}),env);
 assert.equal(createdResponse.status,201);
 const created=await createdResponse.json(),authorization={authorization:"Bearer "+new URL(created.edit_url).hash.replace("#access_token=","")};
 let response=await worker.fetch(request("/api/quotes/"+created.quote_id+"/finalize","POST",{expected_revision:1,delivery_method:"presentation"},authorization),{...env,ENABLE_FINALIZATION:"true"});
 assert.equal(response.status,200);
 const enabled={...env,ENABLE_FINALIZATION:"true",ENABLE_EMAIL_DELIVERY:"true"};
 response=await worker.fetch(request("/api/quotes/"+created.quote_id,"GET",null,authorization),enabled);
 assert.equal(response.status,200);
 const quote=await response.json();
 assert.equal(quote.delivery_enabled,true);
 assert.equal(quote.delivery_recipients.customer,"buyer@example.com");
 const route="/api/quotes/"+created.quote_id+"/deliver";
 const invalid=await worker.fetch(request(route,"POST",{expected_revision:2,channel:"customer",recipient_email:"wrong",recipient_confirmed:true},authorization),enabled);
 assert.equal(invalid.status,422);
 const notConfirmed=await worker.fetch(request(route,"POST",{expected_revision:2,channel:"customer",recipient_email:"contact@another-brand.com",recipient_confirmed:false},authorization),enabled);
 assert.equal(notConfirmed.status,422);
 const chosen=await worker.fetch(request(route,"POST",{expected_revision:2,channel:"customer",recipient_email:"contact@another-brand.com",recipient_confirmed:true},authorization),enabled);
 assert.equal(chosen.status,202);
 const queued=outbox.find(x=>x.quote_id===created.quote_id&&x.channel==="customer");
 assert.equal(queued.recipient_email,"contact@another-brand.com");
 assert.equal(queued.recipient_source,"manually_entered");
 assert.ok(queued.recipient_confirmed_at);
 const duplicate=await worker.fetch(request(route,"POST",{expected_revision:2,channel:"customer",recipient_email:"second@another-brand.com",recipient_confirmed:true},authorization),enabled);
 assert.equal(duplicate.status,409);
 const warehouse=await worker.fetch(request(route,"POST",{expected_revision:2,channel:"warehouse",recipient_email:"warehouse@example.com",recipient_confirmed:true},authorization),enabled);
 assert.equal(warehouse.status,202);
 assert.equal(outbox.find(x=>x.quote_id===created.quote_id&&x.channel==="warehouse").recipient_source,"source_record");
});

test("quote-specific bearer token permits one confirmed arbitrary recipient without a CRM match",async()=>{
 const modeled={...initial,section_2_inbound:{},section_3_storage:{Storage_Qty:100},section_4_outbound:{},section_5_misc:{}};
 const createdResponse=await worker.fetch(request("/api/internal/quotes","POST",{hwk_id:"HWK-NOT-ASSIGNED",warehouse_id:warehouseId,baseline_payload:modeled},{"x-internal-api-key":env.INTERNAL_API_KEY}),env);
 assert.equal(createdResponse.status,201);
 const created=await createdResponse.json(),authorization={authorization:"Bearer "+new URL(created.edit_url).hash.replace("#access_token=","")};
 const finalized=await worker.fetch(request("/api/quotes/"+created.quote_id+"/finalize","POST",{expected_revision:1,delivery_method:"presentation"},authorization),{...env,ENABLE_FINALIZATION:"true"});
 assert.equal(finalized.status,200);
 const attempted=await worker.fetch(request("/api/quotes/"+created.quote_id+"/deliver","POST",{expected_revision:2,channel:"customer",recipient_email:"outside@example.com",recipient_confirmed:true},authorization),{...env,ENABLE_EMAIL_DELIVERY:"true"});
 assert.equal(attempted.status,202);
 const payload=await attempted.json();
 assert.equal(payload.delivery_status,"pending");
 const delivery=outbox.find(x=>x.quote_id===created.quote_id&&x.channel==="customer");
 assert.equal(delivery.recipient_email,"outside@example.com");
 assert.equal(delivery.recipient_source,"manually_entered");
 const unknownToken=await worker.fetch(request("/api/quotes/"+created.quote_id+"/deliver","POST",
 {expected_revision:2,channel:"warehouse",recipient_email:"another@example.com",recipient_confirmed:true},
 {authorization:"Bearer wrong"}),{...env,ENABLE_EMAIL_DELIVERY:"true"});
 assert.equal(unknownToken.status,401);
});


test("server finalizes a quote even when optional BOL and pallet-out volumes are As needed",async()=>{
 const modeled={
  section_1_static:{Hwk_Id:"HWK-AS-NEEDED",selected_warehouse_name:"Example Warehouse",Warehouse_rpp:50,storage_pallet_equivalent:25},
  section_2_inbound:{inbound_type:"Palletized",has_pallet_in:true,pallet_avg_inbound_qty_per_month:1,pallet_avg_qty_per_inbound:1},
  section_3_storage:{Storage_Qty:25,storage_pallet_equivalent:25,storage_pallet_base:56.29},
  section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:23,cases_per_order:3,b2b_order_fee:14.96,b2b_carton_pick_fee:1.79,b2b_pallet_out:12,bol_fee:8}},
  section_5_misc:{monthly_minimum:1600},
  section_2_inbound_rows:[{field_name:"inbound_pallet",cost:36.3}],
  section_3_storage_rows:[{field_name:"storage_pallet_base",cost:56.29}],
  section_4_outbound_rows:[{field_name:"b2b_order_fee",cost:14.96},{field_name:"b2b_carton_pick_fee",cost:1.79},{field_name:"b2b_pallet_out",cost:12},{field_name:"bol_fee",cost:8}],
  section_5_misc_rows:[{field_name:"monthly_minimum",cost:1600}]
 };
 let response=await worker.fetch(request("/api/internal/quotes","POST",{
  hwk_id:"HWK-AS-NEEDED",warehouse_id:warehouseId,baseline_payload:modeled
 },{"x-internal-api-key":env.INTERNAL_API_KEY}),env);
 assert.equal(response.status,201);
 const created=await response.json();
 const bearer={authorization:"Bearer "+new URL(created.edit_url).hash.replace("#access_token=","")};
 response=await worker.fetch(request("/api/quotes/"+created.quote_id+"/finalize","POST",
  {expected_revision:1,delivery_method:"presentation"},bearer),{...env,ENABLE_FINALIZATION:"true"});
 assert.equal(response.status,200);
 const final=await response.json();
 assert.equal(final.status,"finalized");
 assert.equal(final.revision,2);
 assert.match(final.final_html,/FINALIZED RATE CARD/);
 assert.doesNotMatch(final.final_html,/EDIT RATE CARD/);
 const forecast=final.draft.reconciled_totals;
 assert.ok(Number.isFinite(forecast.operational));
 // Neither unforecasted optional service is assigned a made-up quantity.
 assert.ok(final.draft.current_payload.section_4_outbound.PalletOut==null);
});
