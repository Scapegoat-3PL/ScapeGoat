/**
 * Decide who may receive a finalized rate card using authoritative Scapegoat
 * records only. The quote payload / edit link / browser can NEVER authorize a
 * recipient. A valid warehouse email alone does not prove the warehouse is
 * assigned to a specific Hawk ID.
 */
const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const canonicalEmail=value=>{
  const valueString=String(value??"").trim().toLowerCase();
  return emailRegex.test(valueString)?valueString:null;
};
export function resolveVerifiedRecipients({hwkId,warehouseId,warehouse,sourceRows=[]}){
 const empty={
   verified:false,customer:null,warehouse:null,
   reasons:{customer:"The Hawk ID is not assigned to this warehouse in Scapegoat.",warehouse:"The Hawk ID is not assigned to this warehouse in Scapegoat."}
 };
 const id=String(warehouseId||"").trim().toLowerCase();
 const lead=String(hwkId||"").trim();
 if(!warehouse||String(warehouse.warehouse_id||"").trim().toLowerCase()!==id||!lead)return empty;
 const matched=sourceRows.filter(row=>
   String(row.lead_id||"").trim()===lead &&
   String(row.warehouse_id||"").trim().toLowerCase()===id
 );
 if(!matched.length)return empty;
 // Lead email and email are both present in the two CRM source tables.
 // Both must independently agree when populated, otherwise the customer
 // address is held for review. Warehouse delivery may still proceed.
 const customers=new Set();
 for(const row of matched){
   for(const key of ["lead_email","email"]){
     const candidate=canonicalEmail(row[key]);
     if(candidate)customers.add(candidate);
   }
 }
 const warehouseEmail=canonicalEmail(warehouse.warehouse_email);
 const customer=customers.size===1?[...customers][0]:null;
 return {
   verified:true, // the lead-to-warehouse association is confirmed
   customer,
   warehouse:warehouseEmail,
   reasons:{
     customer:customers.size===0?"No valid customer email is recorded for this opportunity.":
       customers.size>1?"Customer email fields disagree; review the Hawkish/VacancyChain contact records.":null,
     warehouse:warehouseEmail?null:"The selected warehouse has no valid warehouse_email recorded."
   }
 };
}


/**
 * A link-holder may explicitly enter a different destination address.
 * This is not independent email verification: it is a manual recipient choice
 * by the authorized warehouse. Keep source-record ownership verification.
 */
export function resolveDeliveryDestination({channel,recipientEmail,recipientConfirmed,verifiedRecipients}){
 if(!["customer","warehouse"].includes(channel))throw Error("Choose customer or warehouse delivery");
 if(!verifiedRecipients?.verified)throw Error("The Hawk ID must belong to the selected warehouse");
 if(recipientConfirmed!==true)throw Error("Confirm the recipient address before sending");
 const selected=String(recipientEmail??"").trim();
 if(selected.length<5||selected.length>254||/[<>,;\r\n]/.test(selected))
   throw Error("Enter one valid recipient email address");
 const email=canonicalEmail(selected);
 if(!email||email.length>254)throw Error("Enter one valid recipient email address");
 const current=canonicalEmail(verifiedRecipients[channel]);
 const recipientSource=current===email?"source_record":"manually_entered";
 return {email,recipientSource};
}
