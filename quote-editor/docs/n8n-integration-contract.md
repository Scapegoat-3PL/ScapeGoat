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
