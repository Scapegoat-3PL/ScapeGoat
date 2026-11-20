function quoteEditActions(html,editUrl){
 if(typeof html!=="string"||!/Let(?:&#0?39;|&apos;|[’\'])s\s+Move\s+Forward/i.test(html))throw Error("Original N5 acceptance action not found");
 if(!editUrl)return html;
 const url=String(editUrl);
 if(!/^https:\/\/scapegoatquoteeditor\.sean-0a8\.workers\.dev\/\?quote_id=[0-9a-f-]{36}#access_token=[a-zA-Z0-9_-]{40,}$/i.test(url))
   throw Error("Invalid secure editor URL");
 const finalize=url.replace("#access_token=","&intent=finalize#access_token=");
 // N5's live HTML uses <div style="margin-top:55px;...">. Never depend
 // on the exact whitespace of the HTML generator's source template.
 const guardrail=/<div\b[^>]*style=["'][^"']*margin-top\s*:\s*55px[^"']*["'][^>]*>/i;
 const matched=guardrail.exec(html);
 if(!matched||!/Guardrails/i.test(html.slice(matched.index,matched.index+1000)))
   throw Error("N5 Guardrails section not found");
 const buttons=[
 '<div style="margin-top:34px;text-align:center;padding:18px 10px;border-top:2px solid #1A202C">',
 '<div style="font-size:12px;letter-spacing:1px;font-weight:800;text-transform:uppercase;color:#1A202C;margin-bottom:14px">Warehouse Rate Card Management</div>',
 '<a href="'+url+'" target="_blank" rel="noopener noreferrer" style="background:#1A202C;color:white;text-decoration:none;padding:13px 18px;font-size:13px;font-weight:800;border:3px solid #1A202C;display:inline-block;margin:5px">EDIT RATE CARD</a>',
 '<a href="'+finalize+'" target="_blank" rel="noopener noreferrer" style="background:#FF4B01;color:white;text-decoration:none;padding:13px 18px;font-size:13px;font-weight:800;border:3px solid #1A202C;display:inline-block;margin:5px">FINALIZE RATE CARD NOW</a>',
 '<div style="font-size:11px;line-height:1.55;color:#475569;margin-top:14px">Warehouse-only secure controls. Do not forward this email; finalize and download a customer-facing copy instead. Finalization requires confirmation in the editor.</div>',
 '</div>'
 ].join('\n');
 return html.slice(0,matched.index)+buttons+"\n"+html.slice(matched.index);
}


const base=$('N5 v').first().json;
if(!base?.html_body||typeof base.html_body!=="string")throw Error("Original N5 quote email is missing");
const attempted=$input.first().json||{};
let editorUrl=typeof attempted.edit_url==="string"?attempted.edit_url:"";
let html=base.html_body,actionStatus="original_quote_no_edit_link",actionError=editorUrl?null:"Quote snapshot child returned no edit URL";
try{
 if(editorUrl){
  html=quoteEditActions(html,editorUrl);
  actionStatus="secure_editor_buttons_added";
 }
}catch(e){
 actionError=String(e.message||e);
 // Never interrupt the customer's original N5 warehouse quote if a
 // supporting edit-link snapshot failed or returned malformed data.
 editorUrl="";
 html=base.html_body;
 actionStatus="original_quote_fallback";
}
return [{json:{...base,html_body:html,editor_link_status:actionStatus,editor_link_created:!!editorUrl,editor_link_error:actionError}}];
