import api from "./index.mjs";

// The edit page remains a static asset. Only /api/* and /health call the API.
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/") || path === "/health") {
      return api.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};
