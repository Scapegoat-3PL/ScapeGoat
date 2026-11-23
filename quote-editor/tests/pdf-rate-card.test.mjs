import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {newDraft} from "../quote-editor-core.mjs";
import {createRateCardPdf,pdfFilename,acceptanceUrl} from "../site/pdf-rate-card.mjs";

const lib=readFileSync(new URL("../site/vendor/jspdf.umd.min.js",import.meta.url),"utf8");
function jsPdfConstructor(){
 const box={exports:{},module:{exports:{}},TextEncoder,TextDecoder,Uint8Array,
  ArrayBuffer,Buffer,console,setTimeout,clearTimeout,atob,btoa};
 box.window=box;box.self=box;box.globalThis=box;
 runInNewContext(lib,box,{timeout:20000});
 const ctor=box.exports.jsPDF||box.module.exports.jsPDF||box.jspdf?.jsPDF;
 assert.equal(typeof ctor,"function","Locally vendored jsPDF UMD library must expose jsPDF");
 return ctor;
}
function fakeQuote(){
 const source={
  section_1_static:{Hwk_Id:"HWK-261123-2040",selected_warehouse_name:"Packhouse Distribution",
   Warehouse_rpp:60,storage_pallet_equivalent:25,city:"Buena Park",state:"CA"},
  section_2_inbound:{inbound_type:"Palletized",has_pallet_in:true,
   pallet_avg_inbound_qty_per_month:1,pallet_avg_qty_per_inbound:1},
  section_3_storage:{storage_type:"Pallet",Storage_Qty:25,storage_pallet_equivalent:25,storage_pallet_base:30},
  section_4_outbound:{DTC:{dtc_vol:0},B2B:{retail_vol:23,cases_per_order:3,b2b_order_fee:14.96,b2b_carton_pick_fee:1.79}},
  section_5_misc:{monthly_minimum:1600},
  section_2_inbound_rows:[{field_name:"inbound_pallet",cost:30}],
  section_3_storage_rows:[{field_name:"storage_pallet_base",cost:30}],
  section_4_outbound_rows:[
   {field_name:"b2b_order_fee",cost:14.96},
   {field_name:"b2b_carton_pick_fee",cost:1.79},
   {field_name:"b2b_pallet_out",cost:12},
   {field_name:"bol_fee",cost:8}
  ],
  section_5_misc_rows:[{field_name:"monthly_minimum",cost:1600}]
 };
 const q=newDraft({quote_id:"11111111-1111-4111-8111-111111111111",
  hwk_id:"HWK-261123-2040",warehouse_id:"22222222-2222-4222-8222-222222222222",baseline_payload:source});
 q.status="finalized";q.finalized_at="2026-11-23T19:00:00.000Z";
 return q;
}
test("real locally bundled PDF renderer returns a PDF, not HTML, with clickable original acceptance route",()=>{
 const Pdf=jsPdfConstructor();
 const doc=createRateCardPdf(fakeQuote(),2,{jsPDF:Pdf,enableAcceptance:true});
 const raw=new Uint8Array(doc.output("arraybuffer"));
 assert.equal(new TextDecoder().decode(raw.subarray(0,5)),"%PDF-");
 assert.ok(raw.byteLength>1000);
 const pdf=new TextDecoder("latin1").decode(raw);
 assert.match(pdf,/\/URI/);
 assert.match(pdf,/bf36f171-cfe7-4262-a74c-52afac05c668/);
 assert.match(pdf,/HWK-261123-2040/);
 assert.match(pdf,/As needed/);
 assert.match(pdf,/B2B/);
});
test("presentation/demo PDF has no live CRM acceptance link",()=>{
 const doc=createRateCardPdf(fakeQuote(),2,{jsPDF:jsPdfConstructor(),enableAcceptance:false});
 const pdf=new TextDecoder("latin1").decode(new Uint8Array(doc.output("arraybuffer")));
 assert.doesNotMatch(pdf,/bf36f171-cfe7-4262-a74c-52afac05c668/);
 assert.equal(pdfFilename(fakeQuote(),2),"Scapegoat-Finalized-Rate-Card-HWK-261123-2040-Rev2.pdf");
});
test("reject draft downloads and invalid acceptance identifiers",()=>{
 const q=fakeQuote();q.status="draft";
 assert.throws(()=>createRateCardPdf(q,2,{jsPDF:jsPdfConstructor()}),/Finalize/);
 assert.equal(acceptanceUrl("HWK-DEMO"),"https://seanskin.app.n8n.cloud/webhook/bf36f171-cfe7-4262-a74c-52afac05c668?hwk_id=HWK-DEMO");
 assert.equal(acceptanceUrl("https://example.test"),null);
});
