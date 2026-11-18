# SCAPEGOAT.OS — Opportunity Quote Editor

**Implementation status (Nov 18, 2026):** Code committed to an isolated feature branch; Cloudflare's separate preview Worker is Git-connected. **Do not merge or deploy against the production site.** The synthetic demo is available only once Cloudflare builds the latest commit. Backend persistence, finalized real quotes, and customer/warehouse email are not live.

## Warehouse workflow

**Generate → Edit → Preview → Finalize → Deliver / Present**

1. Existing n8n N3/N4/N5 generation produces an opportunity-specific quote.
2. A future secure "Edit Rate Card" email link reopens that one opportunity, never changing other warehouses' rates or regional blanket rates.
3. The warehouse may change individual rates, add charges, and **edit source-backed forecast volumes** (including BOL outbound shipment quantity). BOL volume comes from `section_4_outbound.PalletOut.pallet_vol`; pallet-out quantities are recalculated consistently.
4. "**Projected RPP ($/PEQ)**" is calculated from existing N5 operational monthly revenue and PEQs. "Modeled Monthly Revenue" and "One-time Charges" are separate. Custom monthly charges are displayed separately from operational RPP.
5. "**Preview Revised Rate Card**" uses a frozen copy of the existing N5 HTML layout. Call-to-action links are disabled in previews. A quote summary shows generated/finalized timestamps, version, N5 operating revenue and modeled custom charges.
6. "**Finalize Rate Card**" takes a server timestamp, increments revision, reconciles with N5 and makes that revision immutable. Changing Target RPP remains blocked for finalization until authoritative N3 repricing is connected.
7. "**Deliver / Download Final Rate Card**" supports (a) HTML download for forwarding or screenshare; (b) a queued send to the verified customer; or (c) queued send to the verified warehouse. Sending stays **disabled** until a separately approved n8n delivery child workflow is configured.

### Status of the delivery options

| Option | Browser demo | Real connected quote |
|---|---|---|
| Download finalized presentation | Simulated local finalization and HTML download | Built, gated behind staging Supabase + Worker secrets + `ENABLE_FINALIZATION=true` |
| Open for screenshare | Built after local demo finalization | Built, gated until finalization |
| Email directly to customer | Visible but disabled | Built API outbox/hand-off; requires verified customer recipient, approved n8n sender, delivery key and `ENABLE_EMAIL_DELIVERY=true` |
| Email to warehouse | Visible but disabled | Same requirements with verified warehouse recipient |

The server will **not** trust a browser-entered email address. It requires an immutable, trusted `verified_recipients` snapshot with `verified:true` and fixed `customer`/`warehouse` values, attached by the approved source workflow. Delivery requests are audited and deduplicated per quote, revision, and channel. A 202 response means **accepted**, never proof of Gmail transmission.

## Repo files

- `site/index.html`, `site/quote-editor.js` — deployed Cloudflare editor UI.
- `site/quote-editor-core.mjs`, `quote-editor-core.mjs` — rate and source-volume changes, original baseline, pending RPP flag.
- `site/n5-proposal-renderer.mjs` — frozen copy of current N5 email renderer.
- `site/quote-release.mjs`, `quote-release.mjs` — date-stamped N5 final/presentation output and cost summary.
- `worker/index.mjs`, `worker/site-router.mjs` — isolated HTTP API plus secure static routing.
- `sql/001_opportunity_quote_editor.sql` — review-only RLS-protected database schema, immutable finalization, version history, delivery outbox.
- `tests/*.test.mjs` — GitHub Actions regression tests.
- `docs/n8n-integration-contract.md` — one-child-workflow-at-a-time integration plan.
- `wrangler.jsonc` — **repo root** Cloudflare preview configuration. This branch must be deployed via Worker Builds, not merged into main.

No secrets are in GitHub. Cloudflare runtime requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_KEY` as secrets, `EDITOR_ORIGIN` set to preview origin, and finalization flag off until staging tests pass. Email requires `EMAIL_DELIVERY_WEBHOOK` and `EMAIL_DELIVERY_KEY` secrets and a separately approved sender.

## GitHub development checks

Syntax validation and unit tests are run automatically on draft PR #1. Test cases cover BOL forecast quantity and dependent pallets, custom fees, original N5 layout, $100 negotiated rate reduction, immutable timestamped finalization, and locked RPP conditions.

## n8n status

Created and tagged an **inactive** child workflow with an approved goal sticky note:
[Child Workflow — Opportunity Quote Snapshot — Pilot](https://seanskin.app.n8n.cloud/workflow/kaDkGekfNhXAw3XT).

It validates a generated N4 quote and source forecast sections but intentionally **does not make external writes**. Connect it to the Worker staging API only after staging data storage is provisioned and its output reviewed. Do not change the existing live 77-node workflow `Scapegoat v1 Hawkish Live`.

## Remaining blockers

1. Cloudflare latest **feature-branch** deployment has to finish; this chat cannot verify Cloudflare deployment automatically.
2. Supabase **staging branch** needs billing cost approval before creation. There is none yet. The SQL has **not** been applied to production.
3. The Cloudflare Worker needs staging secrets plus a database; finalization is gated by `ENABLE_FINALIZATION=false`.
4. The first n8n Child Workflow's staging snapshot handoff must be wired and tested before building another child workflow.
5. N3 target RPP optimizer must be connected for **new target RPP** requests, preserving negotiated rate locks.
6. Verified customer/warehouse recipients, a separate n8n sender and send confirmations are required before enabling email.
7. Final security review must validate opportunity-to-warehouse association server-side before issuing any customer edit link.

**Not included:** Retroactively editing old rate cards that were never saved as structured quote snapshots. No production main-branch changes, active n8n workflow modifications or live outbound emails.
