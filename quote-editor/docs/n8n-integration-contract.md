# Scapegoat Opportunity Quote Editor — Staging Integration Contract

## Existing generator (read-only audit)

Workflow: **Scapegoat v1 Hawkish Live**, ID XKbLZ6d9WfF1pRpN.

- N1 v3 builds opportunity metadata and quote sections, including section_1_static.Warehouse_rpp.
- N3 vSean.1 performs weighted, bidirectional target RPP optimization. It applies a maximum 30% automatic downward adjustment to eligible categories; upward adjustments are uncapped. Admin and miscellaneous fees are separate from operational RPP.
- N4 vSean.1 creates the line-item arrays:
  section_2_inbound_rows, section_3_storage_rows, section_4_outbound_rows, section_5_misc_rows.
- N5 v renders the branded HTML rate card. **Do not change its presentation.**
- The warehouse quote is currently delivered by email. Add an "Edit Rate Card" action only after the new staging flow is proven.

## Data and API boundaries

Internal quote snapshot (trusted n8n only, after validating opportunity/warehouse association):

POST /api/internal/quotes
Header: X-Internal-API-Key: [Cloudflare secret]
Body: { "hwk_id": "HWK-...", "warehouse_id": "[UUID]", "baseline_payload": { ...N4 structured payload... } }

Result: quote_id, edit_url, expires_at. The edit token is returned once and is hashed before DB storage.
The API also verifies warehouse_id exists. **Production must independently verify the opportunity-to-warehouse authorization before issuing an edit link.** A matching warehouse UUID alone is insufficient.

Warehouse-facing browser uses:
GET /api/quotes/{quote_id}  — Authorization: Bearer [edit token]
PATCH /api/quotes/{quote_id} — {expected_revision,operations:[...]}.

Editing operations: edit_rate, reset_rate, add_line, remove_line, set_target_rpp.
Draft saves never email or publish. Concurrent updates reject stale revisions. Unissued quotes only.

Token delivery: quote URL fragment #access_token=... avoids access-token submission in ordinary HTTP request path. The browser removes it from the address bar and keeps it in tab sessionStorage. Treat edit links as sensitive credentials; add revocation, limits, and login as needed before wider release.

## Child workflow order — one at a time

### 1. Child Workflow — Opportunity Quote Snapshot — Pilot
**Goal for approval:** Accept the sanitized N4 output for a **single test** Hawk ID and warehouse ID. Validate IDs and stored opportunity association. Call staging POST /api/internal/quotes using a stored n8n credential and return an internal-only edit link. No customer email, CRM writes, or production code changes. Attach this goal as a sticky note and tag Child Workflow.

Acceptance: quote renders; manually changing one rate creates revision 2; original baseline remains unchanged; invalid tokens fail; no production email is sent.

### 2. Child Workflow — Opportunity Quote Reprice — Pilot
Reuse N3's actual logic in an isolated call: start from original operational inputs, preserve manually negotiated line rates as **locked**, then redistribute any requested target RPP across eligible unlocked operational rates. Show achieved RPP and residual if exact target cannot be met. No changes to warehouses.rpp or Blanket Rates.

The currently committed browser page **does not** run N3 and explicitly discloses this. Preview calculations use only explicit forecast quantities and are NOT authoritative.

### 3. Child Workflow — Revised Quote Render/Send — Pilot
Use existing N5 output formatting exactly. Provide explicit review/approval. A draft save is not permission to send. Only a separately approved workflow action may issue a revised rate card. Preserve old issued revisions.

## Deployment plan

1. Review this feature branch and run tests. Do not merge automatically.
2. Establish a Cloudflare Pages/Workers preview deployment that does **not** change live root-domain DNS. The current repository includes a CNAME for scapegoat3plwarehouserates.com and may use GitHub Pages.
3. Apply the additive SQL migration only to an isolated Supabase development environment. Do not apply to production yet.
4. Deploy worker/index.mjs on staging. Bind EDITOR_ORIGIN to the exact preview origin; configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and INTERNAL_API_KEY via Cloudflare **secrets**, not public JS or GitHub.
5. Adjust the static editor's API endpoint from its production-domain placeholder to the staging Worker origin **before opening any real quote**.
6. Implement and validate Child Workflow #1, then request review before #2.
7. Confirm N3/N5 reconciliation before enabling Publish and customer email.

### Important limitations
- Current live database has not yet been populated with durable quote payloads for historical re-opening; this feature only supports quotes captured after snapshot integration.
- N4's row arrays typically provide field_name/cost/assumption, but not always billing-unit quantities; normalize explicit operational quantities to quote rows before giving financial projections.
- A test page containing only a synthetic demo cannot be used to send customer-ready pricing.
- This feature branch adds new files; it must not modify existing website pages or active n8n workflows.


## Update: Finalization, dated revisions, delivery routes (Nov 18, 2026)

The editor now offers **Finalize Rate Card** followed by **Deliver / Download Final Rate Card**. The browser demo finalizes locally for presentation review only; actual quote finalization is a server-side operation.

The original N5 email HTML renderer is wrapped into a shared local/server module, preserving the original pricing presentation. A transparent summary differentiates modeled operational charges from custom recurring fees and one-time fees. The N5 accept/continue webhook is removed in downloadable presentation previews.

API routes added, staging feature-flagged:
- POST `/api/quotes/{quote_id}/finalize` with `expected_revision`, `delivery_method:"presentation"`. Server verifies link token, quote status, pending N3 reprice flag and source volume model; computes N5 output itself; stamps UTC `finalized_at`; saves immutable `final_html`; increments revision; never sends email. **Disabled until `ENABLE_FINALIZATION=true` and staging data/secrets are present.**
- POST `/api/quotes/{quote_id}/deliver` with `expected_revision` and `channel:"customer"|"warehouse"`. Server checks immutable finalized quote, trusted `verified_recipients`, audit outbox deduplication, and separated delivery credential. **Disabled until `ENABLE_EMAIL_DELIVERY=true` and approved n8n email sender is configured.** Client-supplied addresses are rejected. A 202 acknowledges the workflow request, not provider send confirmation.

The database migration adds versioned `finalized_at`, immutable finalized state, saved final HTML, audit digest, and `sg_opportunity_rate_quote_deliveries` outbox with unique (quote_id, revision, channel). Not applied yet.

**Source-backed forecast quantity changes:** BOL uses `section_4_outbound.PalletOut.pallet_vol`, pallet-out units = shipments × pallets per shipment. Editing BOL quantity updates shipment volume rather than a disconnected line quantity. N5 is the authoritative calculation for modeled operational revenue; custom monthly and one-time fees are explicitly reported separately. Do not send if N3 reprice is pending or required inputs are missing.

**First Child Workflow created, no activation or writes**:
[Opportunity Quote Snapshot — Pilot](https://seanskin.app.n8n.cloud/workflow/kaDkGekfNhXAw3XT), project: Josh Boren personal, tagged `Child Workflow`. This currently validates input + prepares the normalized payload only. The next reviewed increment would be to connect its authenticated staging API write; do not build another child workflow until this one's output is reviewed. Its goal and guardrails are embedded as a sticky note.

**Deployment dependencies:** Cloudflare uses the existing independent Worker preview `scapegoatquoteeditor.sean-0a8.workers.dev`, with `wrangler.jsonc` routing static assets and API to one origin. Staging Supabase branching requires explicit hourly cost consent; no production tables were changed. Cloudflare secrets must be entered securely in Worker settings. Live N3 and original generator remain unchanged. No customer email has been sent.

