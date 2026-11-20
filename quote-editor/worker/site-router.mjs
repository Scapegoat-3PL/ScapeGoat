/**
 * Isolated Scapegoat quote-editor preview Worker.
 * Static HTML stays on Cloudflare; secured API operations run in the existing
 * Scapegoat Supabase project and require random quote-specific bearer tokens.
 * No Supabase service-role key or secret ever exists in this Worker.
 */
const edgeOrigin = "https://dtmeaqjtreawxnlzkenq.supabase.co/functions/v1/scapegoat-quote-editor";
export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === "/health" || requestUrl.pathname.startsWith("/api/")) {
      const destination = new URL(edgeOrigin + requestUrl.pathname + requestUrl.search);
      try {
        // Forward original short-lived quote authorization headers unchanged.
        // This public Worker does not authenticate anyone by itself.
        const forwarded = new Request(destination, request);
        return await fetch(forwarded, { redirect: "manual" });
      } catch {
        return new Response(JSON.stringify({ error: "Secure quote API unavailable" }), {
          status: 502,
          headers: { "content-type": "application/json", "cache-control": "no-store" }
        });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
