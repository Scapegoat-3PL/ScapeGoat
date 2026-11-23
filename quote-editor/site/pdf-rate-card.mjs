/**
 * Customer-facing PDF rate card - no HTML downloads and no paid PDF service.
 * Built from the same rate lines and authoritative N5 totals as the editor.
 * jsPDF is bundled locally under /vendor with its MIT license.
 */
import {SECTIONS,preview} from "./quote-editor-core.mjs";
import {renderQuoteDocument} from "./quote-release.mjs";

const INK=[26,32,44], ORANGE=[255,75,1], SLATE=[71,85,105],SOFT=[242,245,248],
      BORDER=[207,216,226],WHITE=[255,255,255];
const PAGE={w:612,h:792,left:42,right:42,top:40,bottom:48};
const SECTIONS_NAMES={section_2_inbound_rows:"INBOUND",section_3_storage_rows:"STORAGE",
 section_4_outbound_rows:"OUTBOUND",section_5_misc_rows:"MISCELLANEOUS / VAS"};
const dollars=v=>"$"+Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const quantity=v=>Number(v).toLocaleString("en-US",{maximumFractionDigits:2});
const clean=s=>String(s??"").replace(/\s+/g," ").trim();
const stamp=v=>new Intl.DateTimeFormat("en-US",{year:"numeric",month:"short",day:"numeric",
 timeZone:"America/Los_Angeles"}).format(new Date(v));
const UNIT={inbound_pallet:"Per pallet",master_carton_in:"Per carton",inbound_container_min:"Per container",
 storage_pallet_base:"Per pallet / month",storage_pallet_longterm:"Per pallet / month",
 SQFT_rate:"Per sq. ft. / month",b2c_order_fee:"Per order",b2c_unit_pick:"Per unit",
 b2b_order_fee:"Per order",b2b_carton_pick_fee:"Per carton",b2b_pallet_out:"Per pallet",bol_fee:"Per BOL"};
export function acceptanceUrl(hwkId){
 const id=String(hwkId||"").trim();
 if(!/^HWK-[A-Za-z0-9-]{3,80}$/.test(id))return null;
 return "https://seanskin.app.n8n.cloud/webhook/bf36f171-cfe7-4262-a74c-52afac05c668?hwk_id="+encodeURIComponent(id);
}
export function pdfFilename(quote,revision){
 return "Scapegoat-Finalized-Rate-Card-"+String(quote.hwk_id||"Opportunity").replace(/[^a-z0-9-]/gi,"-")+"-Rev"+Number(revision)+".pdf";
}
export function createRateCardPdf(quote,revision,{jsPDF,enableAcceptance=false}={}){
 if(!quote||quote.status!=="finalized"||!quote.finalized_at)
   throw Error("Finalize the rate card before generating a PDF");
 const Pdf=jsPDF||(typeof window!=="undefined"&&window.jspdf?.jsPDF);
 if(typeof Pdf!=="function")throw Error("PDF renderer is unavailable; refresh the rate card and retry");
 const rendered=renderQuoteDocument(quote,revision,{issuedAt:quote.finalized_at,disableActions:false});
 if(rendered.issues.length)throw Error("Unresolved rate card pricing checks");
 const data=quote.current_payload||{},s1=data.section_1_static||{},rows=preview(quote).rows;
 const doc=new Pdf({unit:"pt",format:"letter",compress:true,putOnlyUsedFonts:true});
 const inner=PAGE.w-PAGE.left-PAGE.right;let y=PAGE.top;
 const setText=(size=10,bold=false,color=INK)=>{
  doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.setTextColor(...color);
 };
 const text=(s,x,yy,{size=10,bold=false,color=INK,align="left"}={})=>{
  setText(size,bold,color);doc.text(clean(s),x,yy,{align});
 };
 const rect=(x,yy,width,height,bg=WHITE)=>{
  doc.setFillColor(...bg);doc.rect(x,yy,width,height,"F");
 };
 const rule=yy=>{doc.setDrawColor(...BORDER);doc.setLineWidth(.7);doc.line(PAGE.left,yy,PAGE.w-PAGE.right,yy)};
 const page=()=>{
  doc.addPage();y=PAGE.top;rect(PAGE.left,y,4,21,ORANGE);
  text("SCAPEGOAT / RATE CARD",PAGE.left+12,y+15,{size:11,bold:true});
  text(quote.hwk_id,PAGE.w-PAGE.right,y+14,{size:9,color:SLATE,align:"right"});
  y+=35;rule(y);y+=15;
 };
 const room=height=>{if(y+height>PAGE.h-PAGE.bottom)page()};
 // Cover header
 rect(0,0,PAGE.w,10,ORANGE);
 text("SCAPEGOAT",PAGE.left,65,{size:27,bold:true});
 text("HAWKISH  /  WAREHOUSE PRICING",PAGE.left,84,{size:9,bold:true,color:SLATE});
 rect(PAGE.w-PAGE.right-135,42,135,45,INK);
 text("FINALIZED",PAGE.w-PAGE.right-67.5,62,{size:11,bold:true,color:WHITE,align:"center"});
 text("REVISION "+revision,PAGE.w-PAGE.right-67.5,79,{size:9,color:WHITE,align:"center"});
 y=106;rule(y);
 text("RATE CARD / OPPORTUNITY",PAGE.left,129,{size:10,bold:true,color:ORANGE});
 const warehouse=clean(s1.selected_warehouse_name||s1.Warehouse_name||"Warehouse Partner");
 setText(20,true);
 const heading=doc.splitTextToSize(warehouse,inner).slice(0,3);
 heading.forEach((line,i)=>text(line,PAGE.left,154+i*23,{size:20,bold:true}));
 y=154+heading.length*23;
 const location=[s1.city,s1.state].filter(Boolean).join(", ");
 if(location){text(location,PAGE.left,y,{size:10,color:SLATE});y+=20;}
 const metadata=[
  ["HAWK ID",quote.hwk_id],["ISSUED",stamp(quote.finalized_at)],
  ["DOCUMENT","Finalized Rate Card"],["VALID THROUGH",stamp(new Date(Date.parse(quote.finalized_at)+30*86400e3))]
 ];
 const metaTop=y+3,half=inner/2+9;
 metadata.forEach((item,i)=>{
  const x=i<2?PAGE.left:PAGE.left+half,yy=metaTop+(i%2)*31;
  text(item[0],x,yy,{size:8,bold:true,color:SLATE});
  text(item[1],x,yy+14,{size:10,bold:true});
 });
 y=metaTop+75;
 const gap=10,cardWidth=(inner-2*gap)/3;
 const cards=[
  ["MODELED MONTHLY",rendered.monthlyOperational],
  ["CUSTOM MONTHLY",rendered.monthlyOther],
  ["PROJECTED MONTHLY",rendered.monthlyTotal]
 ];
 room(86);
 cards.forEach(([label,val],i)=>{
  const x=PAGE.left+i*(cardWidth+gap),inverse=i===2;
  rect(x,y,cardWidth,72,inverse?INK:SOFT);
  text(label,x+10,y+23,{size:8,bold:true,color:inverse?WHITE:SLATE});
  text(dollars(val),x+10,y+52,{size:15,bold:true,color:inverse?WHITE:INK});
 });
 y+=86;
 const rpp=rendered.projectedRpp==null?"Not projected":dollars(rendered.projectedRpp)+" / PEQ";
 text("ONE-TIME: "+dollars(rendered.oneTime)+"    |    MODELED RPP: "+rpp,PAGE.left,y,{size:9,bold:true,color:SLATE});
 y+=21;
 const col={service:PAGE.left+8,unit:PAGE.left+246,rate:PAGE.left+360,qty:PAGE.left+428,value:PAGE.left+inner-8};
 const header=()=>{
  rect(PAGE.left,y,inner,26,SOFT);
  text("SERVICE",col.service,y+17,{size:8,bold:true});
  text("BILLING UNIT",col.unit,y+17,{size:8,bold:true});
  text("RATE",col.rate,y+17,{size:8,bold:true,align:"right"});
  text("QTY",col.qty,y+17,{size:8,bold:true,align:"right"});
  text("EST. VALUE",col.value,y+17,{size:8,bold:true,align:"right"});
  y+=29;
 };
 const row=r=>{
  const label=clean(r.display_label||r.field_name?.replaceAll("_"," ")||"Service");
  const notes=clean(r.assumption||"");
  setText(9,true);const a=doc.splitTextToSize(label,228);
  setText(7.6,false,SLATE);const b=notes?doc.splitTextToSize(notes,228).slice(0,3):[];
  const height=Math.max(36,14*a.length+10*b.length+13);
  room(height+9);
  const base=y;
  a.forEach((v,i)=>text(v,col.service,y+13+14*i,{size:9,bold:true}));
  b.forEach((v,i)=>text(v,col.service,y+15+14*a.length+10*i,{size:7.6,color:SLATE}));
  const unit=clean(r.billing_unit||UNIT[r.field_name]||"Per service");
  text(unit,col.unit,y+15,{size:8.2,color:SLATE});
  text(dollars(r.cost),col.rate,y+15,{size:9,bold:true,align:"right"});
  const q=r.forecast_quantity==null?"As needed":quantity(r.forecast_quantity);
  text(q,col.qty,y+15,{size:8.2,color:r.forecast_quantity==null?SLATE:INK,align:"right"});
  text(r.value==null?"-":dollars(r.value),col.value,y+15,{size:8.4,bold:r.value!=null,align:"right"});
  y=base+height;rule(y);y+=2;
 };
 for(const section of SECTIONS){
  const grouped=rows.filter(r=>r.section===section);
  if(!grouped.length)continue;
  room(75);y+=15;rect(PAGE.left,y,4,18,ORANGE);
  text(SECTIONS_NAMES[section],PAGE.left+11,y+15,{size:13,bold:true});
  y+=27;header();grouped.forEach(row);
 }
 room(165);y+=18;
 text("PRICING NOTES",PAGE.left,y,{size:12,bold:true});y+=15;
 const notes=[
  "Quoted rates apply when the corresponding service is performed.",
  '"As needed" services have no assumed volume and are excluded from projected revenue.',
  "Projected values reflect only the quantities actually supplied for this opportunity.",
  "The Hawk ID and revision above identify this finalized rate card."
 ];
 notes.forEach(n=>{
  setText(8.5,false);const ls=doc.splitTextToSize("- "+n,inner-12);
  room(ls.length*12+7);
  ls.forEach((v,i)=>text(v,PAGE.left+6,y+12*i,{size:8.5,color:SLATE}));
  y+=ls.length*12+6;
 });
 y+=13;room(85);
 const url=enableAcceptance?acceptanceUrl(quote.hwk_id):null;
 if(url){
  rect(PAGE.left,y,inner,53,ORANGE);
  text("LET'S MOVE FORWARD",PAGE.left+inner/2,y+33,{size:14,bold:true,color:WHITE,align:"center"});
  doc.link(PAGE.left,y,inner,53,{url});
  y+=68;
  text("Click the orange button above to request the next step from Hawkish.",PAGE.left,y,{size:8.2,color:SLATE});
 }else{
  rect(PAGE.left,y,inner,44,SOFT);
  text("FINALIZED RATE CARD / PRESENTATION COPY",PAGE.left+inner/2,y+27,{size:10,bold:true,align:"center"});
 }
 const total=doc.getNumberOfPages();
 for(let i=1;i<=total;i++){
  doc.setPage(i);rule(PAGE.h-36);
  text("HAWKISH / SCAPEGOAT",PAGE.left,PAGE.h-22,{size:8,bold:true,color:SLATE});
  text("REF "+(quote.hwk_id||"")+"   PAGE "+i+" / "+total,PAGE.w-PAGE.right,PAGE.h-22,{size:8,color:SLATE,align:"right"});
 }
 doc.setProperties({
  title:"Scapegoat Finalized Rate Card - "+quote.hwk_id,
  author:"Hawkish LLC",
  subject:"Finalized 3PL pricing revision "+revision,
  keywords:"warehouse,fulfillment,rate card,scapegoat,hawkish"
 });
 return doc;
}
