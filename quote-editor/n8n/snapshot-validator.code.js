// Copy of the non-writing n8n Child Workflow validation node.
// Kept in GitHub for code review, change control and regression tests.
// n8n entrypoint: Validate & Normalize N4 Snapshot (No Writes).
const items = $input.all();
if (items.length !== 1) throw new Error("Exactly one opportunity quote per execution");
const raw = items[0].json || {};
const p = raw.baseline_payload && typeof raw.baseline_payload === "object" && !Array.isArray(raw.baseline_payload)
  ? raw.baseline_payload : raw;
const staticData = p.section_1_static;
if (!staticData || typeof staticData !== "object" || Array.isArray(staticData))
  throw new Error("Missing section_1_static");
const hwkId = String(raw.hwk_id || staticData.Hwk_Id || staticData.hwk_id || "").trim();
const warehouseId = String(raw.warehouse_id || staticData.warehouse_id || "").trim();
if (!/^HWK-[A-Za-z0-9-]{6,80}$/.test(hwkId))
  throw new Error("A valid Hawk ID is required");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(warehouseId))
  throw new Error("Warehouse UUID is required");
for (const v of [staticData.Hwk_Id, staticData.hwk_id]) {
  if (v != null && String(v).trim() !== hwkId)
    throw new Error("Hawk ID mismatch between source and snapshot");
}
if (staticData.warehouse_id != null && String(staticData.warehouse_id).trim().toLowerCase() !== warehouseId.toLowerCase())
  throw new Error("Warehouse ID mismatch between source and snapshot");
const rateSections = ["section_2_inbound_rows", "section_3_storage_rows", "section_4_outbound_rows", "section_5_misc_rows"];
let count = 0;
for (const section of rateSections) {
  if (!Array.isArray(p[section])) throw new Error("Missing structured " + section + " from N4");
  const seen = new Set();
  for (const row of p[section]) {
    if (!row || typeof row !== "object" || typeof row.field_name !== "string" || !row.field_name.trim() || row.field_name.length > 150)
      throw new Error("Invalid field name in " + section);
    if (seen.has(row.field_name)) throw new Error("Duplicate field name in " + section + ": " + row.field_name);
    seen.add(row.field_name);
    if (row.cost == null || row.cost === "" || !Number.isFinite(Number(row.cost)) ||
        Number(row.cost) < 0 || Number(row.cost) > 1e9)
      throw new Error("Invalid nonnegative charge for " + row.field_name);
    count++;
  }
}
if (count > 150) throw new Error("Rate card has too many lines");
for (const section of ["section_2_inbound", "section_3_storage", "section_4_outbound", "section_5_misc"]) {
  if (!p[section] || typeof p[section] !== "object" || Array.isArray(p[section]))
    throw new Error("Missing original opportunity quantity model " + section);
}
const copy = JSON.parse(JSON.stringify(p));
copy.generated_at = copy.generated_at || new Date().toISOString();
if (!Number.isFinite(Date.parse(copy.generated_at))) throw new Error("Invalid generation timestamp");
if (JSON.stringify(copy).length > 150000) throw new Error("Quote exceeds 150 KB snapshot limit");
return [{json:{
  status: "validated_staging_only",
  snapshot_allowed: false,
  hwk_id: hwkId,
  warehouse_id: warehouseId,
  baseline_payload: copy,
  child_workflow: "Opportunity Quote Snapshot — Pilot",
  next_step: "Requires review of opportunity-to-warehouse authorization and staging Supabase + Cloudflare credentials before write integration. No email or CRM changes."
}}];
