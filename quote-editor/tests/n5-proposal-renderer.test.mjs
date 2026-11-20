import test from "node:test";
import assert from "node:assert/strict";
import {renderExistingN5Proposal} from "../site/n5-proposal-renderer.mjs";

const sample=()=>({
 section_1_static:{Hwk_Id:"HWK-DEMO",selected_warehouse_name:"Sample Warehouse Partner",city:"Los Angeles",state:"CA",Warehouse_rpp:50,storage_pallet_equivalent:100},
 section_2_inbound:{inbound_type:"Floor-loaded",has_pallet_in:false,has_container_unload:true,container_avg_inbound_qty_per_month:2,container_avg_qty_per_inbound:500,Master_Carton_In:0.68,inbound_container_min:850},
 section_3_storage:{storage_type:"Pallet",Storage_Qty:100,storage_pallet_equivalent:100,storage_pallet_base:20},
 section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:0},PalletOut:{pallet_vol:10,pallets_per_order:10,b2b_pallet_out:13,bol_fee:8}},
 section_5_misc:{monthly_minimum:1000},
 section_2_inbound_rows:[{field_name:"master_carton_in",cost:0.68,assumption:"Carton handling"},{field_name:"inbound_container_min",cost:850,assumption:"Per container minimum"}],
 section_3_storage_rows:[{field_name:"storage_pallet_base",cost:20,assumption:"Monthly rate"}],
 section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13,assumption:"Per pallet"},{field_name:"bol_fee",cost:8,assumption:"Per shipment"}],
 section_5_misc_rows:[]
});
test("original N5 renders same email shell and exact financial breakdown",()=>{
 const p=renderExistingN5Proposal(sample());
 assert.equal(p.hwk_id,"HWK-DEMO");
 assert.match(p.html_body,/Inbound Operations/);
 assert.match(p.html_body,/Storage &amp; Inventory/);
 assert.match(p.html_body,/INBOUND CONTAINER MIN/);
 assert.match(p.html_body,/Validity: Official Quote valid for 30 days/);
 assert.equal(p.rounded_rate_revenue.inbound,1700);
 assert.equal(p.rounded_rate_revenue.storage,2000);
 assert.equal(p.rounded_rate_revenue.outbound,1380);
 assert.equal(p.rounded_rate_revenue.total_variable_revenue,5080);
});
test("changing one negotiated rate updates the actual N5 table and logic and leaves other rates untouched",()=>{
 const a=sample(),b=sample();
 b.section_2_inbound_rows[1].cost=750;
 const before=renderExistingN5Proposal(a),after=renderExistingN5Proposal(b);
 assert.match(after.html_body,/\$750\.00 minimum applies/);
 assert.equal(after.rounded_rate_revenue.inbound,1500);
 assert.equal(after.rounded_rate_revenue.storage,before.rounded_rate_revenue.storage);
 assert.equal(after.rounded_rate_revenue.outbound,before.rounded_rate_revenue.outbound);
});
test("new custom service appears in N5 table; operational RPP math is not silently adjusted",()=>{
 const p=sample();
 p.section_5_misc_rows.push({field_name:"Custom inspection",cost:100,assumption:"Per pallet audited"});
 const out=renderExistingN5Proposal(p);
 assert.match(out.html_body,/CUSTOM INSPECTION/);
 assert.match(out.html_body,/Per pallet audited/);
 assert.equal(out.rounded_rate_revenue.total_variable_revenue,5080);
});
