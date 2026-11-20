/**
 * N3 target RPP repricing adapter (isolated feature branch).
 *
 * Executes the actual frozen N3 + N4 pricing nodes, then constrains them:
 * - Non-negotiated operational lines can rebalance toward the requested RPP
 * - Manually negotiated lines NEVER move
 * - Custom and administrative charges NEVER inflate operational RPP
 * - Downward adjustments cannot fall below 70% of the ORIGINAL generated rate
 * - N5's actual rounded billable output is the source of achieved revenue/RPP
 * - Infeasible targets report an explicit variance, without pretending success
 */
import {runN3} from "./n3-engine.mjs";
import {runN4} from "./n4-engine.mjs";
import {renderExistingN5Proposal} from "./n5-proposal-renderer.mjs";
import {quotePayload} from "./quote-release.mjs";
const round2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const candidates=[
 {section:"section_2_inbound_rows",name:"inbound_pallet",sectionName:"inbound"},
 {section:"section_2_inbound_rows",name:"master_carton_in",sectionName:"inbound"},
 {section:"section_2_inbound_rows",name:"inbound_container_min",sectionName:"inbound"},
 {section:"section_3_storage_rows",name:"storage_pallet_base",sectionName:"storage"},
 {section:"section_3_storage_rows",name:"SQFT_rate",sectionName:"storage"},
 {section:"section_4_outbound_rows",name:"b2c_order_fee",sectionName:"outbound"},
 {section:"section_4_outbound_rows",name:"b2c_unit_pick",sectionName:"outbound"},
 {section:"section_4_outbound_rows",name:"b2b_order_fee",sectionName:"outbound"},
 {section:"section_4_outbound_rows",name:"b2b_carton_pick_fee",sectionName:"outbound"},
 {section:"section_4_outbound_rows",name:"b2b_pallet_out",sectionName:"outbound"},
 {section:"section_4_outbound_rows",name:"bol_fee",sectionName:"outbound"}
];
function nestedCost(p,key,value){
 const s2=p.section_2_inbound??={},s3=p.section_3_storage??={},s4=p.section_4_outbound??={};
 const dtc=s4.DTC??={},b2b=s4.B2B??={},pal=s4.PalletOut??={};
 switch(key){
  case "inbound_pallet":s2.inbound_pallet=value;break;
  case "master_carton_in":s2.Master_Carton_In=value;break;
  case "inbound_container_min":s2.inbound_container_min=value;break;
  case "storage_pallet_base":s3.storage_pallet_base=value;break;
  case "SQFT_rate":s3.SQFT_rate=value;break;
  case "b2c_order_fee":dtc.b2c_order_fee=value;break;
  case "b2c_unit_pick":dtc.b2c_unit_pick=value;break;
  case "b2b_order_fee":b2b.b2b_order_fee=value;break;
  case "b2b_carton_pick_fee":b2b.b2b_carton_pick_fee=value;break;
  case "b2b_pallet_out":pal.b2b_pallet_out=value;break;
  case "bol_fee":pal.bol_fee=value;break;
 }
}
function row(p,c){return p[c.section]?.find(r=>r.field_name===c.name)}
function n5Revenue(d){
 const output=renderExistingN5Proposal(quotePayload(d));
 const monthly=Number(output?.rounded_rate_revenue?.total_variable_revenue);
 if(!Number.isFinite(monthly))throw Error("N5 financial reconciliation failed");
 return round2(monthly);
}
function currentVolumes(p){
 const raw=Number(p.section_1_static?.storage_pallet_equivalent||p.section_3_storage?.storage_pallet_equivalent||p.section_3_storage?.Storage_Qty||0);
 if(!Number.isFinite(raw)||raw<=0)throw Error("Storage pallet equivalents must be greater than zero before repricing");
 return raw;
}
export function repriceQuote(source,newTarget){
 if(!source||source.status!=="draft")throw Error("Only a draft rate card can be repriced");
 const target=round2(newTarget);
 if(!Number.isFinite(target)||target<=0||target>1e7)throw Error("Enter a valid Target RPP above zero");
 const next=structuredClone(source);
 const peq=currentVolumes(next.current_payload);
 const targetRevenue=round2(target*peq);
 const before=n5Revenue(next);
 const n3Input=structuredClone(next.current_payload);
 n3Input.section_1_static.Warehouse_rpp=target;
 // Respect every existing negotiated rate as input baseline to N3.
 for(const c of candidates){const r=row(next.current_payload,c);if(r)nestedCost(n3Input,c.name,Number(r.cost));}
 delete n3Input.yield_optimization;delete n3Input.new_rate_card;
 const n3=runN3(n3Input);
 const n4=runN4(n3);
 const weights=n3.yield_optimization?.category_weights||{};
 const adjustable=[];
 for(const c of candidates){
  const originalRow=row(next.baseline_payload,c);
  const current=row(next.current_payload,c);
  if(!current)continue;
  if(next.manual_overrides?.[c.section+":"+c.name])continue;
  if(!Number.isFinite(Number(current.cost))||Number(current.cost)<=0)continue;
  const n3Row=row(n4,c);
  const min=round2(Math.max(0,Number(originalRow?.cost??current.cost)*0.7));
  const n3Rate=n3Row&&Number.isFinite(Number(n3Row.cost))?Number(n3Row.cost):Number(current.cost);
  const picked=Math.max(min,round2(n3Rate));
  current.cost=picked;
  nestedCost(next.current_payload,c.name,picked);
  adjustable.push({...c,min,weight:Math.max(0.04,Number(weights[c.sectionName])||0.04),base:picked});
 }
 if(!adjustable.length)throw Error("No eligible unlocked operational lines. Unlock a rate or choose another RPP.");
 // Original N3 calculated each category's contribution; preserve its relative
 // weighting during residual reconciliation when some rows were locked.
 const n3Projected=n5Revenue(next);
 const delta=targetRevenue-n3Projected;
 if(Math.abs(delta)>0.009){
  const increase=delta>0;
  const evaluate=scale=>{
    for(const c of adjustable){
     const r=row(next.current_payload,c);
     const relative=Math.max(0.01,c.weight);
     const rate=increase?c.base*(1+scale*relative):c.base*(1-scale*relative);
     const adjusted=round2(Math.max(c.min,rate));
     r.cost=adjusted;
     nestedCost(next.current_payload,c.name,adjusted);
    }
    return n5Revenue(next);
  };
  let low=0,high=1;
  // Find a bracket, stop at category floor or an upper safety cap.
  for(let pass=0;pass<24;pass++){
   const achieved=evaluate(high);
   if((increase&&achieved>=targetRevenue)||(!increase&&achieved<=targetRevenue))break;
   if(!increase&&adjustable.every(c=>row(next.current_payload,c).cost<=c.min))break;
   high*=2;
  }
  for(let i=0;i<38;i++){
   const mid=(low+high)/2;
   const value=evaluate(mid);
   if((increase&&value<targetRevenue)||(!increase&&value>targetRevenue))low=mid;
   else high=mid;
  }
  // Pick the closer rate outcome at either side of the rounding boundary.
  const lo=evaluate(low),loRates=adjustable.map(c=>row(next.current_payload,c).cost);
  const hi=evaluate(high),hiRates=adjustable.map(c=>row(next.current_payload,c).cost);
  const preferred=Math.abs(lo-targetRevenue)<=Math.abs(hi-targetRevenue)?loRates:hiRates;
  adjustable.forEach((c,i)=>{const v=preferred[i];row(next.current_payload,c).cost=v;nestedCost(next.current_payload,c.name,v)});
 }
 const achievedRevenue=n5Revenue(next);
 const achievedRpp=round2(achievedRevenue/peq);
 const residual=round2(target-achievedRpp);
 next.current_payload.section_1_static.Warehouse_rpp=target;
 next.requested_target_rpp=target;
 next.reprice_requested=false;
 next.reprice_result={
  engine:"frozen_n3_n4_n5",
  target_rpp:target,achieved_rpp:achievedRpp,variance_rpp:residual,
  target_monthly_operational:targetRevenue,achieved_monthly_operational:achievedRevenue,
  before_monthly_operational:before,unlocked_rate_count:adjustable.length,
  locked_rate_count:candidates.filter(c=>Boolean(next.manual_overrides?.[c.section+":"+c.name])).length,
  status:Math.abs(residual)<=0.01?"achieved":"target_unreachable_or_rounding_limited",
  calculated_at:new Date().toISOString()
 };
 next.calculation_status=next.reprice_result.status==="achieved"?"n3_reconciled":"target_not_achieved";
 next.reconciled_totals=null; // N5 finalization recomputes authoritative figures.
 return next;
}
