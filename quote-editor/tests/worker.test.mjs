import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.mjs";

const origin="https://scapegoat3plwarehouserates.com";
const apiUrl="https://quote-editor-test.workers.dev";
const env={SUPABASE_URL:"https://test.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"test-service-secret",INTERNAL_API_KEY:"test-internal-key",EDITOR_ORIGIN:origin};
const warehouseId="11111111-1111-4111-8111-111111111111";
const initial={section_1_static:{Warehouse_rpp:50,storage_pallet_equivalent:100},section_2_inbound_rows:[{field_name:"inbound_container_min",cost:850,forecast_quantity:2}],section_3_storage_rows:[{field_name:"storage_pallet_base",cost:20,forecast_quantity:100}],section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13,forecast_quantity:100}],section_5_misc_rows:[]};
const quotes=new Map(),links=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(rawUrl,options={})=>{
 const url=new URL(rawUrl),table=url.pathname.split("/").pop();
 if(url.hostname!=="test.supabase.co"||options.headers.apikey!==env.SUPABASE_SERVICE_ROLE_KEY)throw Error("Unexpected outbound API");
 const method=options.method||"GET",body=options.body?JSON.parse(options.body):null;
 if(table==="warehouses"&&method==="GET")return Response.json(url.searchParams.get("warehouse_id")==="eq."+warehouseId?[{warehouse_id:warehouseId}]:[]);
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
test("server refuses finalization when RPP optimization remains outstanding",async()=>{
 const modeled={...initial,section_2_inbound:{},section_3_storage:{Storage_Qty:100},section_4_outbound:{},section_5_misc:{}};
 const createdResponse=await worker.fetch(request("/api/internal/quotes","POST",{hwk_id:"HWK-RPPTEST",warehouse_id:warehouseId,baseline_payload:modeled},{"x-internal-api-key":env.INTERNAL_API_KEY}),env);
 assert.equal(createdResponse.status,201);
 const created=await createdResponse.json(),bearer={authorization:"Bearer "+new URL(created.edit_url).hash.replace("#access_token=","")};
 const edited=await worker.fetch(request("/api/quotes/"+created.quote_id,"PATCH",{expected_revision:1,operations:[{type:"set_target_rpp",rpp:55}]},bearer),env);
 assert.equal(edited.status,200);
 const rejected=await worker.fetch(request("/api/quotes/"+created.quote_id+"/finalize","POST",{expected_revision:2,delivery_method:"presentation"},bearer),{...env,ENABLE_FINALIZATION:"true"});
 assert.equal(rejected.status,422);
});
