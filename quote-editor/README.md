# SCAPEGOAT.OS — Opportunity Quote Editor

**Live isolated preview (Nov 18, 2026):** [Open editable rate-card demo](https://scapegoatquoteeditor.sean-0a8.workers.dev/?demo=1). GitHub PR #1 stays draft. No paid Supabase branch or new project was created. The existing `ScapeGoat` Supabase project has only four new `sg_opportunity_rate_*` tables, with RLS and service-role-only CRUD. No changes to existing main branch, active N3/N4/N5, CRM or email workflows.

## Verified end-to-end on synthetic opportunity data

- Isolated Cloudflare preview: editor HTML, JS modules, live same-origin API proxy all respond HTTP 200.
- Supabase Edge Function `scapegoat-quote-editor` (version 2) runs securely in the existing project. It uses only Supabase-provided secret keys in its runtime, **never** in Cloudflare or browser JavaScript. Internal quote creation is service-key gated; warehouse GET/PATCH/finalize is cryptographically link-token gated.
- n8n [Child Workflow — Opportunity Quote Snapshot — Pilot](https://seanskin.app.n8n.cloud/workflow/kaDkGekfNhXAw3XT) remains **inactive**, with existing Supabase credential, tagged `Child Workflow`. It validates N4 inputs, generates a 256-bit edit token, writes a quote snapshot and only the token's SHA256 to the new tables, and returns the private edit URL. No customer email is sent.
- Real manual executions: **#11031** saved a draft and hash. **#11033** retrieved a draft with its secret link. **#11034** reduced the synthetic container minimum from $850 to $750, creating revision 2, then read it back. **#11036** loaded a new draft through Cloudflare (200), finalized it (200, revision 2, UTC timestamp and saved HTML), and read the locked final (200). Temporary automated editing/finalization test nodes were removed after execution.
- SQL transaction test proved revision audit, final-HTML digest and finalized immutability, then rolled back. RLS plus table grants deny direct anonymous/authenticated access and disallow service-role DELETE.
- Customer and warehouse **email sending remains disabled**. Finalization and presentation download work for a token-authorized quote. New target RPP requests cannot be finalized until N3 optimizer reruns and reconciles.

## Warehouse workflow

**Generate → Edit rates and quantities → Preview N5 proposal → Finalize (date-stamped immutable revision) → Download/present or choose delivery channel.**

Editable quantities are tied to the opportunity's source volume model. Example: BOL forecast = outbound pallet shipment count; changing BOL shipments updates related outbound pallet quantities. "Projected RPP ($/PEQ)" excludes custom/administrative charges and monthly forecast shows them separately.

The existing N5 proposal HTML template is reused in the browser and server. Its live acceptance link is disabled in preview/finalized presentation files to avoid a stray CRM update.

## Remaining production gates

1. Validate authoritative opportunity-Hawk ID-to-warehouse relationship and verified email recipients **before** adding Edit Rate Card buttons into any existing sent email.
2. Finish N3 automatic RPP redistributions with locked negotiated rates in a **separate** reviewed Child Workflow. Current target RPP changes remain deliberately unfinalizable.
3. Build an approved n8n delivery Child Workflow using Aria (existing send identity), provider message ID audit, idempotent recipient channel, and explicit human initiation. The customer and warehouse email options are visible but disabled.
4. Review final customer-facing HTML, projected billing assumptions, storage minimums, custom fee cadence and transactional revision integrity, before enabling any live customer sends or merging PR #1.

## Code and security

- `site/*` renders the Cloudflare Workers site; `quote-editor-core.mjs` edits one opportunity, `quote-release.mjs` renders N5+timestamp+custom-charge summary.
- `worker/site-router.mjs` forwards /api to the project's new Supabase Edge Function without storing a credential in Cloudflare.
- `supabase-edge/index.ts` hosts the secured API through an existing Supabase project.
- `sql/001_opportunity_quote_editor.sql` and `sql/002_rate_card_backend_acl_hardening.sql` were applied to the existing project (new tables only).
- `n8n/snapshot-validator.code.js` versions the child workflow's input validation.
- `tests/*.test.mjs` and GitHub Actions test integrity, pricing changes, N5 preview/finalization and HTTP access.

Edit links are bearer credentials and must be delivered only to the intended warehouse. Do not copy their `#access_token` value into a public GitHub issue, log, or repository file. A synthetic test link may be shared privately for user acceptance testing.

## Costs

No new billable database branch or project. Existing Supabase, Cloudflare and GitHub usage remains subject to each service's current plan limits.
