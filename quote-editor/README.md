# SCAPEGOAT.OS — Opportunity Rate Card Editor (development)

This is an **isolated, opportunity-scoped editor**. It does **not** change the regional Blanket Rates, the warehouse master RPP, or any published customer rate cards.

## Product workflow
1. Existing N3/N4 quote generator calculates the opportunity's first rate card.
2. A future isolated quote-snapshot child workflow stores the structured quote and issues a secure, expiring edit link for that opportunity and warehouse.
3. The warehouse opens the link from its existing quote email.
4. The warehouse can change an individual line-item price, add a custom billable line, or request a new target RPP.
5. Individual line edits remain fixed. Only an explicit **Recalculate RPP** action should redistribute unlocked rates using the authoritative N3 logic.
6. Save creates an auditable draft revision. **Save does not send email.**
7. A future approved N5 render/send step issues a revised proposal after authoritative reconciliation.

## Implementation gates
- [x] Feature branch created outside main
- [ ] Browser page and standalone demonstration
- [ ] Scoped quote storage / audit schema in staging Supabase
- [ ] Cloudflare Worker with quote-token access control in staging
- [ ] Isolated n8n Child Workflow: snapshot a generated quote
- [ ] Isolated n8n Child Workflow: reprice with N3 while preserving manual line locks
- [ ] Isolated n8n Child Workflow: render with existing N5 branding
- [ ] End-to-end pilot, audit, and explicit production approval

## Guardrails
- Do not edit, rename, disable, or republish any current live n8n workflow.
- Do not modify existing customer-facing proposal, opportunity brief, or email formatting.
- No production migration, deployment, or outbound send before review.
- Do not put Supabase service-role keys, email tokens, or n8n credentials into static website files.
- Discounted line items must not silently cause another RPP redistribution.
- Source of truth for actual RPP math remains the existing N3 optimizer. Draft previews are non-authoritative.

## Existing integration points (inspected)
The active n8n workflow `Scapegoat v1 Hawkish Live` (`XKbLZ6d9WfF1pRpN`) uses `N3 vSean.1` for weighted RPP optimization, `N4 vSean.1` for quote rows, and `N5 v` for branded HTML. The pricing process and the website are separate systems. The website repository holds static HTML.

The original repository CNAME maps `scapegoat3plwarehouserates.com`; verify hosting and Git-connected preview before changing DNS or merging.
