// Opportunity-scoped editing. Does not call live pricing or email systems.
export const SECTIONS = Object.freeze(["section_2_inbound_rows","section_3_storage_rows","section_4_outbound_rows","section_5_misc_rows"]);
const copy=o=>structuredClone(o);
const amount=v=>{if(v===""||v===null||v===undefined||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1e9)throw Error("Invalid non-negative rate");return Math.round(Number(v)*100)/100};
const validate=(d,s)=>{if(!d||d.status!=="draft")throw Error("Quote is not editable");if(s&&!SECTIONS.includes(s))throw Error("Unknown rate category")};
const dirty=d=>{d.calculation_status="needs_reconciliation";d.reconciled_totals=null;d.reprice_result=null;return d};
export function newDraft({quote_id,hwk_id,warehouse_id,baseline_payload}){
 if(!quote_id||!hwk_id||!warehouse_id||!baseline_payload?.section_1_static)throw Error("Missing quote identity");
 const b=copy(baseline_payload);for(const s of SECTIONS){if(!Array.isArray(b[s]))b[s]=[]}
 return {quote_id,hwk_id,warehouse_id,status:"draft",revision:1,baseline_payload:copy(b),current_payload:b,manual_overrides:{},custom_items:[],requested_target_rpp:Number(b.section_1_static.Warehouse_rpp)||null,calculation_status:"original_generation",reconciled_totals:null,generated_at:baseline_payload.generated_at||baseline_payload.section_1_static?.generated_at||new Date().toISOString(),finalized_at:null};
}
export function changeRate(source,section,id,rate){
 validate(source,section);const d=copy(source),row=d.current_payload[section].find(r=>r.field_name===id);
 if(!row)throw Error("Unknown rate line");
 row.cost=amount(rate);d.manual_overrides[section+":"+id]={cost:row.cost};
 const custom=d.custom_items.find(x=>x.id===id);if(custom)custom.cost=row.cost;
 return dirty(d);
}
export function resetRate(source,section,id){
 validate(source,section);const d=copy(source);
 const original=d.baseline_payload[section].find(r=>r.field_name===id),row=d.current_payload[section].find(r=>r.field_name===id);
 if(!original||!row)throw Error("Only generated rates can be reset");
 row.cost=original.cost;row.assumption=original.assumption;delete d.manual_overrides[section+":"+id];
 return dirty(d);
}
export function addLine(source,{id,section,description,rate,unit,frequency,quantity=null,assumption=""}){
 validate(source,section);const d=copy(source);
 if(!/^custom_[a-z0-9_-]{6,100}$/i.test(id)||SECTIONS.some(s=>d.current_payload[s].some(r=>r.field_name===id)))throw Error("Invalid or repeated custom ID");
 if(!description?.trim()||description.length>150||!unit?.trim()||unit.length>80||!["per_event","recurring","one_time"].includes(frequency))throw Error("Incomplete custom service");
 if(quantity!==null&&(!Number.isFinite(Number(quantity))||Number(quantity)<0))throw Error("Invalid quantity");
 const item={id,section,description:description.trim(),cost:amount(rate),unit,frequency,quantity:quantity===null?null:Number(quantity),assumption:String(assumption).slice(0,1200)};
 d.custom_items.push(item);
 d.current_payload[section].push({field_name:id,display_label:item.description,cost:item.cost,assumption:item.assumption,custom:true,billing_unit:unit,billing_frequency:frequency,forecast_quantity:item.quantity});
 return dirty(d);
}
export function removeLine(source,id){
 validate(source);const d=copy(source),item=d.custom_items.find(i=>i.id===id);
 if(!item)throw Error("Only custom items may be removed");
 d.custom_items=d.custom_items.filter(i=>i.id!==id);d.current_payload[item.section]=d.current_payload[item.section].filter(r=>r.field_name!==id);delete d.manual_overrides[item.section+":"+id];return dirty(d);
}
export function targetRpp(source,value){
 validate(source);const d=copy(source),r=amount(value);if(!r)throw Error("Target RPP must be greater than zero");
 d.requested_target_rpp=r;d.reprice_requested=true;d.current_payload.section_1_static.Warehouse_rpp=r;return dirty(d);
}
export function operations(source,ops){
 if(!Array.isArray(ops)||ops.length===0||ops.length>30)throw Error("Provide 1–30 operations");
 return ops.reduce((d,op)=>{
 switch(op.type){
 case "edit_rate":return changeRate(d,op.section,op.field_name,op.rate);
 case "edit_quantity":return changeQuantity(d,op.section,op.field_name,op.quantity);
 case "reset_rate":return resetRate(d,op.section,op.field_name);
 case "add_line":return addLine(d,op);
 case "remove_line":return removeLine(d,op.id);
 case "set_target_rpp":return targetRpp(d,op.rpp);
 default:throw Error("Unsupported edit operation");
 }
 },source);
}
export function preview(d){
 const rows=[];let operational=0,monthlyOther=0,oneTime=0,unknown=0;
 for(const section of SECTIONS)for(const r of d.current_payload[section]){
 const qty=getForecastQuantity(d,section,r.field_name).quantity,known=qty!==undefined&&qty!==null&&Number.isFinite(Number(qty))&&Number(qty)>=0;
 const price=Number(r.cost),value=known?Math.round(Number(qty)*price*100)/100:null,frequency=r.billing_frequency||"recurring";
 const inRpp=section!=="section_5_misc_rows"&&frequency!=="one_time"&&r.included_in_rpp!==false;
 if(value===null&&r.custom)unknown++;else if(value===null){}else if(frequency==="one_time")oneTime+=value;else if(inRpp)operational+=value;else monthlyOther+=value;
 rows.push({...r,section,value,forecast_quantity:qty,quantity_source:getForecastQuantity(d,section,r.field_name).source});
 }
 const peq=Number(d.current_payload.section_1_static?.storage_pallet_equivalent);
 return {rows,monthly:Math.round((operational+monthlyOther)*100)/100,oneTime:Math.round(oneTime*100)/100,rpp:Number.isFinite(peq)&&peq>0?Math.round(operational/peq*100)/100:null,unknown};
}


// Resolve quantities from the ORIGINAL opportunity volume model instead of
// requiring duplicate forecast inputs on each price row. This avoids falsely
// reporting missing BOL/warehouse volumes.
export function getForecastQuantity(d,section,id){
 const p=d.current_payload,s2=p.section_2_inbound||{},s3=p.section_3_storage||{},s4=p.section_4_outbound||{};
 const pc=s4.PalletOut||{},dtc=s4.DTC||{},b2b=s4.B2B||{};
 const n=(...values)=>{for(const v of values){if(v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v)))return Number(v)}return null};
 const m=(a,b)=>a===null||b===null?null:Math.round(a*b*100)/100;
 const palletIn=n(s2.pallet_avg_inbound_qty_per_month,s2.pallet_monthly_inbound_vol,s2.pallet_inbound_vol);
 const palletPer=n(s2.pallet_avg_qty_per_inbound,s2.pallet_qty_per_inbound);
 const conIn=n(s2.container_avg_inbound_qty_per_month,s2.container_monthly_inbound_vol,s2.container_inbound_vol);
 const cartons=n(s2.container_avg_qty_per_inbound,s2.container_qty_per_inbound);
 const shipments=n(pc.pallet_vol);
 const palletPerOrder=n(pc.pallets_per_order);
 const dtcOrders=n(dtc.dtc_vol),units=n(dtc.unit_per_order),b2bOrders=n(b2b.retail_vol),cases=n(b2b.cases_per_order);
 const known={
  inbound_pallet:m(palletIn,palletPer),
  master_carton_in:m(conIn,cartons),
  inbound_container_min:conIn,
  storage_pallet_base:n(s3.Storage_Qty,s3.storage_pallet_equivalent,p.section_1_static?.storage_pallet_equivalent),
  SQFT_rate:n(s3.Storage_Qty),
  b2c_order_fee:dtcOrders,
  b2c_unit_pick:m(dtcOrders,units),
  b2b_order_fee:b2bOrders,
  b2b_carton_pick_fee:m(b2bOrders,cases),
  b2b_pallet_out:m(shipments,palletPerOrder),
  bol_fee:shipments
 };
 if(Object.hasOwn(known,id)&&known[id]!==null)return {quantity:known[id],source:"opportunity",derived:true};
 const row=p[section]?.find(r=>r.field_name===id);
 const val=row?.forecast_quantity;
 return {quantity:val===null||val===undefined||val===""?null:Number(val),source:row?.custom?"custom":"manual",derived:false};
}
export function changeQuantity(source,section,id,quantity){
 validate(source,section);const d=copy(source),q=amount(quantity),p=d.current_payload;
 const r=p[section]?.find(x=>x.field_name===id);if(!r)throw Error("Unknown rate line");
 const s2=p.section_2_inbound??={};const s3=p.section_3_storage??={};const s4=p.section_4_outbound??={};
 const pc=s4.PalletOut??={};const dtc=s4.DTC??={};const b2b=s4.B2B??={};
 const divide=(x,y)=>{if(!Number.isFinite(Number(y))||Number(y)<=0)throw Error("Enter the parent shipment/order volume first");return x/Number(y)};
 switch(id){
  case "bol_fee":pc.pallet_vol=q;break;
  case "b2b_pallet_out":pc.pallets_per_order=divide(q,pc.pallet_vol);break;
  case "storage_pallet_base":s3.Storage_Qty=q;s3.storage_pallet_equivalent=q;p.section_1_static.storage_pallet_equivalent=q;break;
  case "SQFT_rate":s3.Storage_Qty=q;break;
  case "inbound_container_min":s2.container_avg_inbound_qty_per_month=q;break;
  case "master_carton_in":s2.container_avg_qty_per_inbound=divide(q,s2.container_avg_inbound_qty_per_month);break;
  case "inbound_pallet":s2.pallet_avg_inbound_qty_per_month=divide(q,s2.pallet_avg_qty_per_inbound);break;
  case "b2c_order_fee":dtc.dtc_vol=q;break;
  case "b2c_unit_pick":dtc.unit_per_order=divide(q,dtc.dtc_vol);break;
  case "b2b_order_fee":b2b.retail_vol=q;break;
  case "b2b_carton_pick_fee":b2b.cases_per_order=divide(q,b2b.retail_vol);break;
  default:r.forecast_quantity=q;break;
 }
 const custom=d.custom_items.find(x=>x.id===id);if(custom)custom.quantity=q;
 d.quantity_overrides??={};d.quantity_overrides[section+":"+id]={quantity:q,changed_at:new Date().toISOString()};
 return dirty(d);
}
export function pricingIssues(d){
 const issues=[];if(d.reprice_requested)issues.push("Target RPP requires N3 optimization before finalization");
 if(d.calculation_status==="target_not_achieved")issues.push("Target RPP is not achievable with the locked rates or N3 downside guardrail; adjust the target before finalizing");
 // Missing forecast quantities NEVER prevent a rate card from being
 // finalized. Those lines remain priced "As needed" and must not be assigned
 // a fictitious quantity or added to modeled monthly revenue. This applies
 // to generated rates and manually added services alike.
 return issues;
}
