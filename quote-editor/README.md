# SCAPEGOAT.OS — Opportunity Rate Card Editor

**Status:** Feature-branch code for review. **Not deployed; no live n8n workflows or production Supabase tables changed.**

## What is implemented

- quote-editor.html: Scapegoat-branded, responsive opportunity-level editor.
- quote-editor.js: secure quote link loading, individual rate edits, new service charges, quote-specific target RPP input, draft saving and reload, synthetic demo.
- quote-editor-core.mjs: line overrides and manual locks, immutable generated baseline, RPP requests, operation validation, illustrative totals.
- worker/index.mjs: Cloudflare staging API for authorized quote snapshots, scoped expiring edit tokens, GET, and optimistic-concurrency PATCH. No publish or email endpoint.
- sql/001_opportunity_quote_editor.sql: additive RLS-protected Supabase tables and transactional revision history. Review-only; not applied.
- tests/editor.test.mjs and .github/workflows/quote-editor-tests.yml: isolated Node tests and CI.
- docs/n8n-integration-contract.md: N3/N4/N5 connection contract and subsequent Child Workflow ordering.

## Warehouse experience

A secure Edit Rate Card link will eventually appear in the existing warehouse quote email. The warehouse can edit a single line or add an additional charge without affecting other pricing. Changing the target RPP is a separate request for N3 optimizer reconciliation; negotiated individual line rates should remain locked.

Save creates a draft only. Sending a revised quote is disabled until authoritative N3 calculations and the original-format N5 rendering have been connected and approved.

## Local synthetic demo

From the repository root, start a local server:

    python3 -m http.server 8765

Visit:

    http://localhost:8765/quote-editor/quote-editor.html?demo=1

The demo runs entirely in the browser with synthetic data. Save and Publish are disabled.

Run the tests:

    node --test quote-editor/tests/*.test.mjs

## Remaining release gates

1. Review pull request and CI; configure isolated Cloudflare preview deployment (not live root-domain routing).
2. Apply the additive SQL to a staging Supabase environment only after review.
3. Deploy the Worker with staging secrets and the exact preview origin; update the browser API URL from its placeholder.
4. Build one n8n Child Workflow at a time: Quote Snapshot, then N3 Reprice, then N5 Render/Send. Tag each Child Workflow and attach its agreed goal.
5. Verify HWK-to-warehouse authorization, forecast quantities, RPP reconciliation, discounts, and quote revisions.
6. Obtain explicit approval for production workflow changes, customer emails, merging, and deployment.

The original root-level index.html, pricing.html, onboard.html and CNAME are unchanged.
