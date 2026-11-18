import test from "node:test";
import assert from "node:assert/strict";
import {newDraft,changeRate,addLine,resetRate,removeLine,targetRpp,operations,preview} from "../quote-editor-core.mjs";
const original={section_1_static:{Warehouse_rpp:50,storage_pallet_equivalent:100},section_2_inbound_rows:[{field_name:"inbound_container_min",cost:850,forecast_quantity:2,billing_unit:"container"}],section_3_storage_rows:[{field_name:"storage_pallet_base",cost:20,forecast_quantity:100}],section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13,forecast_quantity:100}],section_5_misc_rows:[]};
const draft=()=>newDraft({quote_id:"test-quote",hwk_id:"HWK-TEST",warehouse_id:"test-warehouse",baseline_payload:original});
test("negotiated rate changes one line and preserves immutable baseline",()=>{
 const d=changeRate(draft(),"section_2_inbound_rows","inbound_container_min",750);
 assert.equal(d.current_payload.section_2_inbound_rows[0].cost,750);
 assert.equal(d.current_payload.section_3_storage_rows[0].cost,20);
 assert.equal(d.baseline_payload.section_2_inbound_rows[0].cost,850);
 assert.deepEqual(d.manual_overrides["section_2_inbound_rows:inbound_container_min"],{cost:750});
 assert.equal(resetRate(d,"section_2_inbound_rows","inbound_container_min").current_payload.section_2_inbound_rows[0].cost,850);
});
test("custom line stays opportunity-specific and is removable",()=>{
 const d=addLine(draft(),{id:"custom_inspection",section:"section_5_misc_rows",description:"Inspection",rate:75,unit:"pallet",frequency:"one_time",quantity:3});
 assert.equal(d.current_payload.section_5_misc_rows.length,1);
 assert.equal(d.baseline_payload.section_5_misc_rows.length,0);
 assert.equal(preview(d).oneTime,225);
 assert.equal(removeLine(d,"custom_inspection").current_payload.section_5_misc_rows.length,0);
});
test("target RPP changes do not redistribute negotiated charges",()=>{
 const d=changeRate(draft(),"section_2_inbound_rows","inbound_container_min",750);
 const e=targetRpp(d,55);
 assert.equal(e.requested_target_rpp,55);
 assert.equal(e.current_payload.section_2_inbound_rows[0].cost,750);
 assert.equal(e.calculation_status,"needs_reconciliation");
});
test("reject invalid rates and unauthorized operations",()=>{
 assert.throws(()=>changeRate(draft(),"section_3_storage_rows","storage_pallet_base",-1),/Invalid/);
 assert.throws(()=>addLine(draft(),{id:"invalid",section:"section_5_misc_rows",description:"x",rate:1,unit:"each",frequency:"one_time"}),/Invalid/);
 assert.throws(()=>operations(draft(),[{type:"change_warehouse",warehouse_id:"fake"}]),/Unsupported/);
});
test("quantities missing produce incomplete previews, not invented totals",()=>{
 const d=draft();delete d.current_payload.section_3_storage_rows[0].forecast_quantity;
 assert.equal(preview(d).unknown,1);
 assert.equal(preview(d).rpp,30);
});
