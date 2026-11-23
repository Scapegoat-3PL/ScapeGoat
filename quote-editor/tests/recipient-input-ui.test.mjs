import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../site/index.html",import.meta.url),"utf8");
const browser=readFileSync(new URL("../site/quote-editor.js",import.meta.url),"utf8");
test("finalized customer and warehouse email input is editable",()=>{
 assert.match(html,/<input\s+id="recipient"\s+type="email"/);
 assert.doesNotMatch(html,/<input\s+id="recipient"[^>]*\breadonly\b/i);
 assert.match(html,/Recipient email \(editable\)|you can edit this/i);
});
test("editing a destination enables a validated deliberate send, not a silent send",()=>{
 assert.match(browser,/\$\("recipient"\)\.addEventListener\("input"/);
 assert.match(browser,/emailIsValid\(requested\)/);
 assert.match(browser,/window\.confirm\(/);
 assert.match(browser,/recipient_email:recipientEmail,recipient_confirmed:true/);
});

test("finalize-and-send handles arbitrary addresses from secure quotes in one action",()=>{
 assert.match(browser,/Finalize & Send Rate Card/);
 assert.match(browser,/if\(quote\.status==="draft"\)/);
 assert.match(browser,/await api\("\/api\/quotes\/"\+encodeURIComponent\(quoteId\)\+"\/finalize"/);
 assert.match(browser,/await api\("\/api\/quotes\/"\+encodeURIComponent\(quoteId\)\+"\/deliver"/);
 assert.match(browser,/recipient_email:recipientEmail,recipient_confirmed:true/);
});
test("public demonstration offers an addressed email draft instead of an unauthenticated mail relay",()=>{
 assert.match(browser,/Download Addressed Email Draft/);
 assert.match(browser,/function downloadDemoEmailDraft\(to\)/);
 assert.match(browser,/message\/rfc822/);
 assert.match(browser,/No Aria email was sent/);
});
