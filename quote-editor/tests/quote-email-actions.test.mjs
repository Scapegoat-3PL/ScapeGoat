import test from "node:test";
import assert from "node:assert/strict";
import {quoteEditActions} from "../n8n/quote-email-actions.mjs";
import {renderExistingN5Proposal} from "../n5-proposal-renderer.mjs";
const rates={
 section_1_static:{Hwk_Id:"HWK-EXAMPLE",Warehouse_rpp:50,storage_pallet_equivalent:100},
 section_2_inbound:{inbound_type:"Pallet in",has_pallet_in:true,pallet_avg_inbound_qty_per_month:2,pallet_avg_qty_per_inbound:20,inbound_pallet:12},
 section_3_storage:{storage_type:"Pallet",Storage_Qty:100,storage_pallet_equivalent:100,storage_pallet_base:20},
 section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:0},PalletOut:{pallet_vol:10,pallets_per_order:10,b2b_pallet_out:13,bol_fee:8}},
 section_5_misc:{monthly_minimum:1000},
 section_2_inbound_rows:[{field_name:"inbound_pallet",cost:12}],
 section_3_storage_rows:[{field_name:"storage_pallet_base",cost:20}],
 section_4_outbound_rows:[{field_name:"b2b_pallet_out",cost:13},{field_name:"bol_fee",cost:8}],
 section_5_misc_rows:[]
};
test("N5 warehouse quote has secure management links without changing rates",()=>{
 const html=renderExistingN5Proposal(rates).html_body;
 const link="https://scapegoatquoteeditor.sean-0a8.workers.dev/?quote_id=11111111-1111-4111-8111-111111111111#access_token="+("A".repeat(43));
 const updated=quoteEditActions(html,link);
 assert.match(updated,/EDIT RATE CARD/);
 assert.match(updated,/FINALIZE RATE CARD NOW/);
 assert.match(updated,/intent=finalize/);
 assert.match(updated,/Let's Move Forward/);
 assert.match(updated,/Warehouse-only secure controls/);
 assert.equal(quoteEditActions(html,null),html);
});
test("rejects malformed editor URLs rather than distributing unsafe links",()=>{
 const html=renderExistingN5Proposal(rates).html_body;
 assert.throws(()=>quoteEditActions(html,"https://evil.example/"),/Invalid secure editor URL/);
});


test("actual November 20 N5 email HTML formatting receives both management buttons",()=>{
 // Real email has encoded apostrophe and a single-line Guardrails style tag.
 const html=[
 '<html><head><title>Rate Card Proposal</title></head><body>',
 '<div>Storage &amp; Inventory</div>',
 '<div style="margin-top:55px;padding:25px;border:4px solid #1a202c;background-color:#ffffff">',
 '<h3 style="margin:0 0 15px 0;font-size:13px">Guardrails</h3>',
 '</div>',
 '<div style="margin-top:55px;text-align:center;margin-bottom:20px">',
 '<a href="https://example.test/accept">Let&#39;s Move Forward</a>',
 '</div></body></html>'
 ].join("\n");
 const link="https://scapegoatquoteeditor.sean-0a8.workers.dev/?quote_id=11111111-1111-4111-8111-111111111111#access_token="+("A".repeat(43));
 const result=quoteEditActions(html,link);
 assert.match(result,/EDIT RATE CARD/);
 assert.match(result,/FINALIZE RATE CARD NOW/);
 assert.ok(result.indexOf("EDIT RATE CARD")<result.indexOf("Guardrails"));
 assert.match(result,/Let&#39;s Move Forward/);
 assert.match(result,/intent=finalize#access_token=/);
});
