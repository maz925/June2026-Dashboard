const DEFAULT_HAPANA_BASE_URL = "https://api.hapana.com/v2";
const { get } = require("@vercel/blob");

const HAPANA_PROXY_VERSION = "hapana-stored-weekly-first-v2-2026-06-04";

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

    if (url.searchParams.get("mode") === "sites") {
      const sites = await listSites();
      response.status(200).json({
        source: "Hapana Public API",
        updated: new Date().toISOString(),
        sites
      });
      return;
    }

    const storedRevenue = await loadStoredWeeklyRevenue();
    if (storedRevenue?.rolling?.length) {
      response.status(200).json({
        version: HAPANA_PROXY_VERSION,
        source: storedRevenue.source || "Hapana Core Net Revenue Detail",
        updated: storedRevenue.updated,
        rolling: storedRevenue.rolling,
        weekEnding: storedRevenue.weekEnding,
        dateFrom: storedRevenue.dateFrom,
        dateTo: storedRevenue.dateTo,
        failures: storedRevenue.failures || []
      });
      return;
    }

    response.status(200).json({
      version: HAPANA_PROXY_VERSION,
      source: "Hapana Core Net Revenue Detail",
      updated: new Date().toISOString(),
      rolling: [],
      note: "No stored weekly revenue has been written yet. Run /api/weekly-revenue first."
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

async function loadStoredWeeklyRevenue() {
  const result = await get("weekly-revenue.json", { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) return null;
  return new Response(result.stream).json();
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
