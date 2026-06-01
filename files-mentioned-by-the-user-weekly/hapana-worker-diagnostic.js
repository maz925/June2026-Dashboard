const DEFAULT_BASE_URLS = [
  "https://api.hapana-app.com/v2",
  "https://api.hapana-app.com",
  "https://api.hapana.com/v2",
  "https://api.hapana.com",
  "https://apidocs.hapana.com"
];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse(null, 204);

    const baseUrls = (env.HAPANA_BASE_URLS || env.HAPANA_BASE_URL || DEFAULT_BASE_URLS.join(","))
      .split(",")
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean);
    const paths = ["/", "/health", "/payments?status=completed&limit=1"];
    const authModes = authCandidates(env);
    const results = [];

    for (const baseUrl of baseUrls) {
      for (const path of paths) {
        for (const auth of authModes) {
          const url = `${baseUrl}${path}`;
          let response;
          let text = "";
          try {
            response = await fetch(url, { headers: auth.headers });
            text = await response.text();
          } catch (error) {
            results.push({
              baseUrl,
              path,
              authMode: auth.name,
              status: "fetch-error",
              ok: false,
              bodyPreview: error.message
            });
            continue;
          }

          results.push({
            baseUrl,
            path,
            authMode: auth.name,
            status: response.status,
            ok: response.ok,
            bodyPreview: text.slice(0, 180)
          });
        }
      }
    }

    return corsResponse({
      message: "Hapana diagnostic. No secret values are returned.",
      testedBaseUrls: baseUrls,
      results
    });
  }
};

function authCandidates(env) {
  const candidates = [{ name: "none", headers: { "Accept": "application/json" } }];
  const key = env.HAPANA_API_KEY;
  const bearer = env.HAPANA_BEARER_TOKEN;

  if (key) {
    candidates.push({
      name: "X-Hapana-API-Key",
      headers: { "Accept": "application/json", "X-Hapana-API-Key": key }
    });

    candidates.push({
      name: "Basic",
      headers: { "Accept": "application/json", "Authorization": `Basic ${btoa(key)}` }
    });
  }

  if (bearer) {
    candidates.push({
      name: "Bearer",
      headers: { "Accept": "application/json", "Authorization": `Bearer ${bearer}` }
    });
  }

  return candidates;
}

function corsResponse(body, status = 200) {
  return new Response(body ? JSON.stringify(body, null, 2) : null, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    }
  });
}
