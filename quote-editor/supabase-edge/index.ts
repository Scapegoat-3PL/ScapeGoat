/**
 * Scapegoat Quote Editor — dedicated Supabase Edge Function.
 * Reuses isolated Cloudflare quote API logic and existing N5 renderer.
 * No additional Supabase project or paid branch; no production n8n writes.
 *
 * Supabase provides SUPABASE_URL and secret keys inside the Edge Function
 * environment. Those keys are never sent to the warehouse browser.
 *
 * verify_jwt=false is intentional: warehouse edit links use application-managed
 * cryptographically random tokens. Internal quote creation requires the
 * existing project service key as x-internal-api-key.
 */
import app from "./api.mjs";

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const modern = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return modern.default || "";
  } catch {
    return "";
  }
}
const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
  SUPABASE_SERVICE_ROLE_KEY: serviceKey(),
  INTERNAL_API_KEY: serviceKey(),
  EDITOR_ORIGIN: "https://scapegoatquoteeditor.sean-0a8.workers.dev",
  ENABLE_FINALIZATION: "true",
  ENABLE_EMAIL_DELIVERY: "true"
};

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const prefix = "/scapegoat-quote-editor";
  if (url.pathname === prefix) url.pathname = "/health";
  else if (url.pathname.startsWith(prefix + "/")) {
    url.pathname = url.pathname.slice(prefix.length);
  } else {
    return Response.json({ error: "Invalid route" }, { status: 404 });
  }
  try {
    // This does not bypass quote-token checks in the underlying application.
    return await app.fetch(new Request(url.toString(), request), ENV);
  } catch (error) {
    console.error("Quote editor API error", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
});
