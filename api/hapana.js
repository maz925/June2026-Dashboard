const DEFAULT_HAPANA_BASE_URL = "https://api.hapana.com/v2";

const CLUB_SITE_IDS = {
  "Wetherill Park": "UWNnS2tUM3VDeUN0YTlaWlBDM3lqdz09",
  "Bankstown": "Z0R6ZkxvWThJWGxEeUxnd2UyY2tKdz09",
  "580G": "QTBOOHBBZDRFL3F5QjNBcTJaZHdxUT09",
  "Woolooware": "RTM4ZWdHWjNnVUdPeXl4TDlmWVFVUT09"
};

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const sites = await listSites();

    if (url.searchParams.get("mode") === "sites") {
      response.status(200).json({
        source: "Hapana Public API",
        updated: new Date().toISOString(),
        sites
      });
      return;
    }

    response.status(200).json({
      source: "Hapana Public API",
      updated: new Date().toISOString(),
      sites,
      rolling: [],
      clubSiteIds: CLUB_SITE_IDS,
      note: "Hapana Public API is connected, but the documented endpoints do not expose a site-level DD/POS payment feed."
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};

async function listSites() {
  const body = await hapanaGet("/site");
  return (body.data || []).map((site) => ({
    id: site.siteID,
    name: site.siteName,
    region: site.siteRegion || null,
    state: site.siteState || null,
    country: site.siteCountry || null
  }));
}

async function hapanaGet(path) {
  const accessID = process.env.HAPANA_ACCESS_ID;
  if (!accessID) throw new Error("HAPANA_ACCESS_ID is not configured");

  const baseUrl = process.env.HAPANA_BASE_URL || DEFAULT_HAPANA_BASE_URL;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    headers: {
      "Accept": "application/json",
      "accessID": accessID
    }
  });

  if (!response.ok) throw new Error(`Hapana request failed: ${response.status}`);

  const body = await response.json();
  if (body.success === false || body.code >= 400) {
    throw new Error(body.message || `Hapana returned ${body.code}`);
  }

  return body;
}
