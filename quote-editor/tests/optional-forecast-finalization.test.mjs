import test from "node:test";
import assert from "node:assert/strict";
import {newDraft,pricingIssues,preview,getForecastQuantity,changeQuantity,addLine} from "../quote-editor-core.mjs";
import {renderQuoteDocument} from "../quote-release.mjs";

const example={
 section_1_static:{Hwk_Id:"HWK-OPTIONAL",selected_warehouse_name:"Example Warehouse",Warehouse_rpp:50,storage_pallet_equivalent:25},
 section_2_inbound:{inbound_type:"Palletized",has_pallet_in:true,pallet_avg_inbound_qty_per_month:1,pallet_avg_qty_per_inbound:1},
 section_3_storage:{Storage_Qty:25,storage_pallet_equivalent:25,storage_pallet_base:56.29},
 section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:23,cases_per_order:3,b2b_order_fee:14.96,b2b_carton_pick_fee:1.79,b2b_pallet_out:12,bol_fee:8}},
 section_5_misc:{monthly_minimum:1600},
 section_2_inbound_rows:[{field_name:"inbound_pallet",cost:36.30}],
 section_3_storage_rows:[{field_name:"storage_pallet_base",cost:56.29}],
 section_4_outbound_rows:[
  {field_name:"b2b_order_fee",cost:14.96},
  {field_name:"b2b_carton_pick_fee",cost:1.79},
  {field_name:"b2b_pallet_out",cost:12},
  {field_name:"bol_fee",cost:8}
 ],
 section_5_misc_rows:[{field_name:"monthly_minimum",cost:1600}]
};
const draft=()=>newDraft({quote_id:"TEST-OPTIONAL",hwk_id:"HWK-OPTIONAL",warehouse_id:"TEST-WH",baseline_payload:example});
test("optional unforecasted outbound pallet and BOL services do not block finalization",()=>{
 const d=draft();
 assert.equal(getForecastQuantity(d,"section_4_outbound_rows","b2b_pallet_out").quantity,null);
 assert.equal(getForecastQuantity(d,"section_4_outbound_rows","bol_fee").quantity,null);
 assert.deepEqual(pricingIssues(d),[]);
 const out=preview(d).rows;
 for(const name of ["b2b_pallet_out","bol_fee"]){
  const row=out.find(x=>x.field_name===name);
  assert.equal(row.forecast_quantity,null);
  assert.equal(row.value,null);
  assert.ok(row.cost>0);
 }
 const doc=renderQuoteDocument(d,1);
 assert.equal(doc.issues.length,0);
 assert.ok(Number.isFinite(doc.monthlyOperational));
 assert.match(doc.html_body,/RATE CARD|Rate Card/i);
});
test("optional outbound charges are projected if quantities later arrive",()=>{
 const d=draft();
 // 23 forecast BOL shipments and 46 pallet picks, only when supplied.
 const withBol=changeQuantity(d,"section_4_outbound_rows","bol_fee",23);
 const withPallets=changeQuantity(withBol,"section_4_outbound_rows","b2b_pallet_out",46);
 assert.equal(getForecastQuantity(withPallets,"section_4_outbound_rows","bol_fee").quantity,23);
 assert.equal(getForecastQuantity(withPallets,"section_4_outbound_rows","b2b_pallet_out").quantity,46);
 const view=preview(withPallets).rows;
 assert.equal(view.find(x=>x.field_name==="bol_fee").value,184);
 assert.equal(view.find(x=>x.field_name==="b2b_pallet_out").value,552);
 assert.deepEqual(pricingIssues(withPallets),[]);
});
test("unforecasted generated rate lines remain As needed and cannot block finalization",()=>{
 const d=draft();
 delete d.current_payload.section_4_outbound.B2B.retail_vol;
 assert.deepEqual(pricingIssues(d),[]);
 const modeled=preview(d).rows.find(r=>r.field_name==="b2b_order_fee");
 assert.equal(modeled.forecast_quantity,null);
 assert.equal(modeled.value,null);
 assert.equal(modeled.cost,14.96);
});
test("a custom service with As needed quantity is quotable without inventing usage",()=>{
 const d=addLine(draft(),{
   id:"custom_as_needed_01",
   section:"section_5_misc_rows",
   description:"Ad-hoc handling",
   rate:45,
   unit:"hour",
   frequency:"per_event",
   quantity:null
 });
 assert.deepEqual(pricingIssues(d),[]);
 const row=preview(d).rows.find(x=>x.field_name==="custom_as_needed_01");
 assert.equal(row.forecast_quantity,null);
 assert.equal(row.value,null);
 const rendered=renderQuoteDocument(d,1);
 assert.equal(rendered.issues.length,0);
 assert.equal(rendered.monthlyOther,0);
 assert.match(rendered.html_body,/Ad-hoc handling/);
});
test("unreconciled Target RPP still blocks finalization independent of missing volumes",()=>{
 const d=draft();
 d.reprice_requested=true;
 assert.match(pricingIssues(d).join(" "),/N3 optimization/);
});
