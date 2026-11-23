import test from "node:test";
import assert from "node:assert/strict";
import {newDraft,changeRate,targetRpp} from "../quote-editor-core.mjs";
import {repriceQuote} from "../n3-reprice.mjs";
import {renderQuoteDocument} from "../quote-release.mjs";
const fixture=()=>({
 section_1_static:{Hwk_Id:"HWK-N3TEST",Warehouse_rpp:50,storage_pallet_equivalent:100},
 section_2_inbound:{inbound_type:"Floor-loaded",has_pallet_in:false,has_container_unload:true,container_avg_inbound_qty_per_month:2,container_avg_qty_per_inbound:500,Master_Carton_In:0.68,inbound_container_min:850},
 section_3_storage:{storage_type:"Pallet",Storage_Qty:100,storage_pallet_equivalent:100,storage_pallet_base:20},
 section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:0},PalletOut:{pallet_vol:10,pallets_per_order:10,b2b_pallet_out:13,bol_fee:8}},
 section_5_misc:{monthly_minimum:1000},
 section_2_inbound_rows:[{field_name:"master_carton_in",cost:0.68},{field_name:"inbound_container_min",cost:850}],
 section_3_storage_rows:[{field_name:"storage_pallet_base",cost:20},{field_name:"storage_pallet_longterm",cost:30}],
 section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13},{field_name:"bol_fee",cost:8}],
 section_5_misc_rows:[{field_name:"monthly_minimum",cost:1000}]
});
const make=()=>newDraft({quote_id:"N3-TEST",hwk_id:"HWK-N3TEST",warehouse_id:"FAKE",baseline_payload:fixture()});
const find=(d,section,id)=>d.current_payload[section].find(r=>r.field_name===id).cost;
test("changing Target RPP actually runs N3-N4 and yields N5 reconciled revenue",()=>{
 const d=make(),from=renderQuoteDocument(d,1).monthlyOperational;
 const result=repriceQuote(d,60);
 const after=renderQuoteDocument(result,2);
 assert.equal(from,5080);
 assert.equal(result.reprice_requested,false);
 assert.equal(result.reprice_result.engine,"frozen_n3_n4_n5");
 assert.ok(after.monthlyOperational>from);
 assert.ok(Math.abs(result.reprice_result.achieved_rpp-60)<=0.01);
 assert.equal(result.calculation_status,"n3_reconciled");
 assert.equal(find(d,"section_3_storage_rows","storage_pallet_base"),20);
});
test("negotiated storage rate is locked while N3 redistributes other categories",()=>{
 let d=make();
 d=changeRate(d,"section_3_storage_rows","storage_pallet_base",19);
 const result=repriceQuote(d,58);
 assert.equal(find(result,"section_3_storage_rows","storage_pallet_base"),19);
 assert.ok(Math.abs(result.reprice_result.achieved_rpp-58)<=0.01);
 assert.equal(result.reprice_result.locked_rate_count,1);
 assert.equal(d.current_payload.section_1_static.Warehouse_rpp,50);
});
test("infeasible downward Target RPP reports residual instead of quietly accepting wrong rates",()=>{
 let d=make();
 d=changeRate(d,"section_2_inbound_rows","inbound_container_min",850);
 d=changeRate(d,"section_3_storage_rows","storage_pallet_base",20);
 d=changeRate(d,"section_4_outbound_rows","b2b_pallet_out",13);
 d=changeRate(d,"section_4_outbound_rows","bol_fee",8);
 const r=repriceQuote(d,5);
 assert.equal(find(r,"section_3_storage_rows","storage_pallet_base"),20);
 assert.equal(find(r,"section_4_outbound_rows","bol_fee"),8);
 assert.equal(r.reprice_result.status,"target_unreachable_or_rounding_limited");
 assert.ok(r.reprice_result.variance_rpp<0);
 assert.equal(r.calculation_status,"target_not_achieved");
});
