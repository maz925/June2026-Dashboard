const DEFAULT_HAPANA_BASE_URL = "https://api.hapana.com/v2";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    try {
      const url = new URL(request.url);
      if (url.pathname === "/sites") {
        return corsResponse({
          source: "Hapana API",
          updated: new Date().toISOString(),
          sites: await listSites(env)
        });
      }

      if (url.pathname === "/clients") {
        const siteID = url.searchParams.get("siteID");
        if (!siteID) throw new Error("siteID is required");

        return corsResponse({
          source: "Hapana API",
          updated: new Date().toISOString(),
          clients: await listClients(env, siteID, {
            lastModifiedDate: url.searchParams.get("lastModifiedDate"),
            pageSize: url.searchParams.get("pageSize"),
            pageIndex: url.searchParams.get("pageIndex")
          })
        });
      }

      if (url.pathname === "/client-purchases") {
        const siteID = url.searchParams.get("siteID");
        const clientID = url.searchParams.get("clientID");
        const email = url.searchParams.get("email");
        if (!siteID) throw new Error("siteID is required");
        if (!clientID && !email) throw new Error("clientID or email is required");

        return corsResponse({
          source: "Hapana API",
          updated: new Date().toISOString(),
          purchases: await listClientPurchases(env, siteID, { clientID, email })
        });
      }

      const clubSiteIds = JSON.parse(env.CLUB_SITE_IDS || "{}");
      if (!Object.keys(clubSiteIds).length) {
        throw new Error("CLUB_SITE_IDS is required");
      }

      if (env.HAPANA_PUBLIC_API_ONLY === "true") {
        return corsResponse({
          source: "Hapana Public API",
          updated: new Date().toISOString(),
          sites: await listSites(env),
          rolling: [],
          note: "Hapana Public API is connected, but the documented endpoints do not expose a site-level DD/POS payment feed."
        });
      }

      const payments = await listPayments(env);
      const rolling = buildRollingRows(payments, clubSiteIds, env);

      return corsResponse({
        source: "Hapana API",
        updated: new Date().toISOString(),
        rolling
      });
    } catch (error) {
      return corsResponse({ error: error.message }, 500);
    }
  }
};

async function listPayments(env) {
  const payments = [];
  const baseUrl = env.HAPANA_BASE_URL || DEFAULT_HAPANA_BASE_URL;
  const endpoint = env.HAPANA_PAYMENTS_PATH || "/payments";
  const maxPages = Number(env.HAPANA_MAX_PAGES || 20);
  let startingAfter = "";

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`);
    url.searchParams.set("status", "completed");
    url.searchParams.set("limit", "100");
    url.searchParams.append("expand[]", "client");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const response = await fetch(url, { headers: authHeaders(env) });
    if (!response.ok) throw new Error(`Hapana payments request failed: ${response.status}`);

    const body = await response.json();
    const pagePayments = body.data || [];
    payments.push(...pagePayments);

    if (!body.hasMore && !body.has_more) break;
    startingAfter = pagePayments[pagePayments.length - 1]?.id;
    if (!startingAfter) break;
  }

  return payments;
}

async function listSites(env) {
  const baseUrl = env.HAPANA_BASE_URL || DEFAULT_HAPANA_BASE_URL;
  const body = await hapanaGet(env, `${baseUrl.replace(/\/$/, "")}/site`);
  return (body.data || []).map((site) => ({
    id: site.siteID,
    name: site.siteName,
    region: site.siteRegion || null,
    state: site.siteState || null,
    country: site.siteCountry || null
  }));
}

async function listClients(env, siteID, options = {}) {
  const baseUrl = env.HAPANA_BASE_URL || DEFAULT_HAPANA_BASE_URL;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/customer/client`);
  if (options.lastModifiedDate) url.searchParams.set("lastModifiedDate", options.lastModifiedDate);
  if (options.pageSize) url.searchParams.set("pageSize", options.pageSize);
  if (options.pageIndex) url.searchParams.set("pageIndex", options.pageIndex);
  return hapanaGet(env, url, siteID);
}

async function listClientPurchases(env, siteID, { clientID, email }) {
  const baseUrl = env.HAPANA_BASE_URL || DEFAULT_HAPANA_BASE_URL;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/customer/client/purchases`);
  if (clientID) url.searchParams.set("clientID", clientID);
  if (email) url.searchParams.set("email", email);
  const body = await hapanaGet(env, url, siteID);
  return body.data || [];
}

async function hapanaGet(env, url, siteID = "") {
  const response = await fetch(url, { headers: authHeaders(env, siteID) });
  if (!response.ok) throw new Error(`Hapana request failed: ${response.status}`);

  const body = await response.json();
  if (body.success === false || body.code >= 400) {
    throw new Error(body.message || `Hapana returned ${body.code}`);
  }
  return body;
}

function authHeaders(env, siteID = "") {
  const headers = { "Accept": "application/json" };
  if (env.HAPANA_ACCESS_ID) headers.accessID = env.HAPANA_ACCESS_ID;
  if (siteID) headers.siteID = siteID;
  if (env.HAPANA_API_KEY) headers.accessID = env.HAPANA_API_KEY;
  if (env.HAPANA_BEARER_TOKEN) headers.Authorization = `Bearer ${env.HAPANA_BEARER_TOKEN}`;
  return headers;
}

function buildRollingRows(payments, clubSiteIds, env) {
  const clubBySiteId = Object.fromEntries(Object.entries(clubSiteIds).map(([club, siteId]) => [siteId, club]));
  const groups = new Map();

  for (const payment of payments) {
    const club = clubBySiteId[getSiteId(payment)];
    if (!club) continue;

    const createdAt = payment.createdAt || payment.created_at || payment.created || payment.date;
    if (!createdAt) continue;

    const weekEnding = weekEndingThursday(createdAt);
    const revenueType = classifyRevenue(payment);
    const key = `${weekEnding}|${club}`;

    if (!groups.has(key)) {
      groups.set(key, {
        weekEnding,
        club,
        ddActual: 0,
        ddTarget: null,
        ddGap: null,
        posActual: 0,
        posTarget: null,
        posPercent: null,
        targetPercent: null,
        status: ""
      });
    }

    const row = groups.get(key);
    if (revenueType === "dd") row.ddActual += paymentAmount(payment, env);
    if (revenueType === "pos") row.posActual += paymentAmount(payment, env);
  }

  return [...groups.values()]
    .map((row) => ({
      ...row,
      ddActual: round2(row.ddActual),
      posActual: round2(row.posActual),
      posPercent: row.ddActual ? round1((row.posActual / row.ddActual) * 100) : null
    }))
    .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding) || a.club.localeCompare(b.club));
}

function getSiteId(payment) {
  return payment.client?.homeLocationId
    || payment.client?.home_location_id
    || payment.client?.locationId
    || payment.client?.location_id
    || payment.locationId
    || payment.location_id
    || payment.siteId
    || payment.site_id
    || payment.metadata?.siteId
    || payment.metadata?.site_id
    || payment.metadata?.locationId
    || payment.metadata?.location_id;
}

function paymentAmount(payment, env) {
  const amount = Number(payment.amount ?? payment.amountPaid ?? payment.amount_paid ?? payment.total ?? 0);
  return env.HAPANA_AMOUNT_IS_CENTS === "false" ? amount : amount / 100;
}

function classifyRevenue(payment) {
  const haystack = [
    payment.paymentMethod,
    payment.payment_method,
    payment.method,
    payment.type,
    payment.description,
    payment.metadata?.revenueType,
    payment.metadata?.revenue_type,
    payment.metadata?.paymentType,
    payment.metadata?.payment_type,
    payment.metadata?.category
  ].filter(Boolean).join(" ").toLowerCase();

  if (haystack.includes("direct debit") || haystack.includes("dd")) return "dd";
  return "pos";
}

function weekEndingThursday(value) {
  const date = new Date(value);
  const day = date.getUTCDay();
  const daysUntilThursday = (4 - day + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysUntilThursday);
  return date.toISOString().slice(0, 10);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function corsResponse(body, status = 200) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    }
  });
}
