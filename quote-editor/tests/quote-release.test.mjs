import test from "node:test";
import assert from "node:assert/strict";
import {newDraft,changeRate,changeQuantity,addLine} from "../quote-editor-core.mjs";
import {renderQuoteDocument} from "../quote-release.mjs";
const baseline=()=>({
 section_1_static:{Hwk_Id:"HWK-TEST",selected_warehouse_name:"Example Warehouse",Warehouse_rpp:50,storage_pallet_equivalent:100},
 section_2_inbound:{inbound_type:"Floor-loaded",has_pallet_in:false,has_container_unload:true,container_avg_inbound_qty_per_month:2,container_avg_qty_per_inbound:500,Master_Carton_In:0.68,inbound_container_min:850},
 section_3_storage:{storage_type:"Pallet",Storage_Qty:100,storage_pallet_equivalent:100,storage_pallet_base:20},
 section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:0},PalletOut:{pallet_vol:10,pallets_per_order:10,b2b_pallet_out:13,bol_fee:8}},
 section_5_misc:{monthly_minimum:1000},
 section_2_inbound_rows:[{field_name:"master_carton_in",cost:0.68},{field_name:"inbound_container_min",cost:850}],
 section_3_storage_rows:[{field_name:"storage_pallet_base",cost:20}],
 section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13},{field_name:"bol_fee",cost:8}],
 section_5_misc_rows:[]
});
const draft=()=>newDraft({quote_id:"TEST",hwk_id:"HWK-TEST",warehouse_id:"TEST",baseline_payload:baseline()});
test("final proposal includes issue timestamp and no active n8n acceptance action",()=>{
 const issuedAt="2026-11-18T20:20:00.000Z";
 const doc=renderQuoteDocument(draft(),2,{issuedAt,disableActions:true});
 assert.match(doc.html_body,/FINALIZED RATE CARD/);
 assert.match(doc.html_body,/Finalized:/);
 assert.match(doc.html_body,/Valid through:/);
 assert.match(doc.html_body,/Projected Charges/);
 assert.doesNotMatch(doc.html_body,/<a\s+href=/);
 assert.equal(doc.monthlyOperational,5080);
 assert.equal(doc.projectedRpp,50.8);
});
test("BOL forecast change updates N5 operational volume and subtotal",()=>{
 const q=changeQuantity(draft(),"section_4_outbound_rows","bol_fee",8);
 const doc=renderQuoteDocument(q,2);
 assert.equal(doc.monthlyOperational,4804);
 assert.equal(doc.projectedRpp,48.04);
 assert.match(doc.html_body,/8 shipments/);
});
test("new monthly custom charge appears in N5 table and transparent summary",()=>{
 let q=addLine(draft(),{id:"custom_inspection",section:"section_5_misc_rows",description:"Inspection",rate:25,unit:"pallet",frequency:"recurring",quantity:50});
 const doc=renderQuoteDocument(q,2);
 assert.equal(doc.monthlyOperational,5080);
 assert.equal(doc.monthlyOther,1250);
 assert.equal(doc.monthlyTotal,6330);
 assert.match(doc.html_body,/INSPECTION/);
 assert.match(doc.html_body,/6,330\.00/);
});
test("negotiated rate cut changes N5 figures without redistributing other sections",()=>{
 const q=changeRate(draft(),"section_2_inbound_rows","inbound_container_min",750);
 const doc=renderQuoteDocument(q,2);
 assert.equal(doc.monthlyOperational,4880);
 assert.match(doc.html_body,/\$750\.00 minimum applies/);
 assert.match(doc.html_body,/Storage &amp; Inventory/);
});
