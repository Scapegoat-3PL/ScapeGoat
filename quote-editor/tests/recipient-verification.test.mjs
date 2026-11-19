import test from "node:test";
import assert from "node:assert/strict";
import {resolveVerifiedRecipients as verify,resolveDeliveryDestination as selectDestination} from "../recipient-verification.mjs";
const wid="11111111-1111-4111-8111-111111111111",lead="HWK-EXAMPLE";
const warehouse={warehouse_id:wid,warehouse_email:"Shipping@Warehouse.com"};
const paired=[{lead_id:lead,warehouse_id:wid,email:"Buyer@Brand.com",lead_email:"buyer@brand.com"}];
test("verified customer and warehouse require an exact Hawk ID/warehouse match",()=>{
 const actual=verify({hwkId:lead,warehouseId:wid,warehouse,sourceRows:paired});
 assert.equal(actual.verified,true);
 assert.equal(actual.customer,"buyer@brand.com");
 assert.equal(actual.warehouse,"shipping@warehouse.com");
 assert.equal(actual.reasons.customer,null);
});
test("synthetic/nonassociated quotes cannot use even a valid warehouse email",()=>{
 const actual=verify({hwkId:"HWK-SYNTHETIC",warehouseId:wid,warehouse,sourceRows:paired});
 assert.equal(actual.verified,false);
 assert.equal(actual.customer,null);
 assert.equal(actual.warehouse,null);
 assert.match(actual.reasons.warehouse,/not assigned/);
});
test("customer mismatch blocks only customer channel, not verified warehouse",()=>{
 const actual=verify({hwkId:lead,warehouseId:wid,warehouse,sourceRows:[
 ...paired,{lead_id:lead,warehouse_id:wid,email:"second@brand.com"}
 ]});
 assert.equal(actual.verified,true);
 assert.equal(actual.customer,null);
 assert.equal(actual.warehouse,"shipping@warehouse.com");
 assert.match(actual.reasons.customer,/disagree/);
});
test("independently malformed emails are not treated as verified",()=>{
 const actual=verify({hwkId:lead,warehouseId:wid,warehouse:{...warehouse,warehouse_email:"N/A"},sourceRows:[{lead_id:lead,warehouse_id:wid,email:"invalid"}]});
 assert.equal(actual.verified,true);
 assert.equal(actual.customer,null);
 assert.equal(actual.warehouse,null);
 assert.match(actual.reasons.customer,/No valid customer/);
});
test("opportunity email in a different warehouse cannot authorize this warehouse",()=>{
 const other="22222222-2222-4222-8222-222222222222";
 const actual=verify({hwkId:lead,warehouseId:wid,warehouse,sourceRows:[{...paired[0],warehouse_id:other}]});
 assert.equal(actual.verified,false);
});

test("editable address is accepted after explicit warehouse confirmation and owner verification",()=>{
 const verified=verify({hwkId:lead,warehouseId:wid,warehouse,sourceRows:paired});
 const custom=selectDestination({
  channel:"customer",recipientEmail:"NEW+Contact@OtherCo.com",recipientConfirmed:true,verifiedRecipients:verified
 });
 assert.equal(custom.email,"new+contact@otherco.com");
 assert.equal(custom.recipientSource,"manually_entered");
 const official=selectDestination({
  channel:"warehouse",recipientEmail:"shipping@warehouse.com",recipientConfirmed:true,verifiedRecipients:verified
 });
 assert.equal(official.recipientSource,"source_record");
});
test("reject malformed email, missing confirmation, and unassociated quote",()=>{
 const verified=verify({hwkId:lead,warehouseId:wid,warehouse,sourceRows:paired});
 assert.throws(()=>selectDestination({channel:"customer",recipientEmail:"a@b.com",recipientConfirmed:false,verifiedRecipients:verified}),/Confirm/);
 assert.throws(()=>selectDestination({channel:"customer",recipientEmail:"not-an-email",recipientConfirmed:true,verifiedRecipients:verified}),/valid recipient/);
 assert.throws(()=>selectDestination({channel:"warehouse",recipientEmail:"person@example.com,other@example.com",recipientConfirmed:true,verifiedRecipients:verified}),/valid recipient/);
 assert.throws(()=>selectDestination({channel:"customer",recipientEmail:"person@example.com",recipientConfirmed:true,verifiedRecipients:{verified:false}}),/must belong/);
});
