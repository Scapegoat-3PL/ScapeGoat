import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const code=readFileSync(new URL("../n8n/snapshot-validator.code.js",import.meta.url),"utf8");
const sample=()=>({
 hwk_id:"HWK-261118-1234",
 warehouse_id:"11111111-1111-4111-8111-111111111111",
 baseline_payload:{
  section_1_static:{Hwk_Id:"HWK-261118-1234",warehouse_id:"11111111-1111-4111-8111-111111111111",Warehouse_rpp:50,storage_pallet_equivalent:100},
  section_2_inbound:{inbound_type:"Floor-loaded",container_avg_inbound_qty_per_month:2},
  section_3_storage:{Storage_Qty:100},
  section_4_outbound:{PalletOut:{pallet_vol:10,pallets_per_order:10}},
  section_5_misc:{monthly_minimum:1000},
  section_2_inbound_rows:[{field_name:"inbound_container_min",cost:850}],
  section_3_storage_rows:[{field_name:"storage_pallet_base",cost:20}],
  section_4_outbound_rows:[{field_name:"bol_fee",cost:8}],
  section_5_misc_rows:[]
 }});
const validate=x=>runInNewContext("(function(){\n"+code+"\n})()",{$input:{all:()=>[{json:x}]},Date,Set,JSON,Number,String,Array,Error,Object,RegExp});
test("snapshot retains original inbound/outbound quantity inputs with added generation time",()=>{
 const out=validate(sample())[0].json;
 assert.equal(out.status,"validated_staging_only");
 assert.equal(out.snapshot_allowed,false);
 assert.equal(out.baseline_payload.section_4_outbound.PalletOut.pallet_vol,10);
 assert.ok(out.baseline_payload.generated_at);
});
test("rejects mismatched Hawk and warehouse identity",()=>{
 const a=sample();a.baseline_payload.section_1_static.Hwk_Id="HWK-261118-9999";
 assert.throws(()=>validate(a),/Hawk ID mismatch/);
 const b=sample();b.baseline_payload.section_1_static.warehouse_id="22222222-2222-4222-8222-222222222222";
 assert.throws(()=>validate(b),/Warehouse ID mismatch/);
});
test("rejects duplicated, missing, negative, and nonnumeric rates",()=>{
 const a=sample();a.baseline_payload.section_4_outbound_rows.push({field_name:"bol_fee",cost:7});
 assert.throws(()=>validate(a),/Duplicate field name/);
 const b=sample();b.baseline_payload.section_4_outbound_rows[0].cost=-2;
 assert.throws(()=>validate(b),/Invalid nonnegative charge/);
 const c=sample();c.baseline_payload.section_3_storage_rows[0].cost="oops";
 assert.throws(()=>validate(c),/Invalid nonnegative charge/);
});
test("requires original quantity model, not only rendered rate rows",()=>{
 const a=sample();delete a.baseline_payload.section_4_outbound;
 assert.throws(()=>validate(a),/quantity model/);
});
