const DEFAULT_HAPANA_BASE_URL = "https://api.hapana-app.com/v2";
const CLUB_NAMES = ["Wetherill Park", "Bankstown", "580G", "Woolooware"];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse(null, 204);

    try {
      const payments = await listPayments(env);
      const rolling = buildRollingRows(payments);

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
  const maxPages = Number(env.HAPANA_MAX_PAGES || 20);
  let startingAfter = "";

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${baseUrl(env)}/payments`);
    url.searchParams.set("status", "completed");
    url.searchParams.set("limit", "100");
    url.searchParams.append("expand[]", "client");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const response = await fetch(url, { headers: authHeaders(env) });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Hapana payments request failed: ${response.status} ${body.slice(0, 200)}`);
    }

    const body = await response.json();
    const pagePayments = body.data || [];
    payments.push(...pagePayments);

    if (!body.hasMore && !body.has_more) break;
    startingAfter = pagePayments[pagePayments.length - 1]?.id;
    if (!startingAfter) break;
  }

  return payments;
}

function authHeaders(env) {
  const headers = { "Accept": "application/json" };
  const keyLooksLikeBasic = env.HAPANA_API_KEY && env.HAPANA_API_KEY.includes(":");

  if ((env.HAPANA_AUTH_MODE === "basic" || keyLooksLikeBasic) && env.HAPANA_API_KEY) {
    headers.Authorization = `Basic ${btoa(env.HAPANA_API_KEY)}`;
  } else if (env.HAPANA_API_KEY) {
    headers["X-Hapana-API-Key"] = env.HAPANA_API_KEY;
  }
  if (env.HAPANA_BEARER_TOKEN) headers.Authorization = `Bearer ${env.HAPANA_BEARER_TOKEN}`;
  return headers;
}

function baseUrl(env) {
  return (env.HAPANA_BASE_URL || DEFAULT_HAPANA_BASE_URL).replace(/\/$/, "");
}

function buildRollingRows(payments) {
  const groups = new Map();

  for (const payment of payments) {
    const club = findClub(payment);
    if (!club) continue;

    const weekEnding = weekEndingThursday(payment.createdAt);
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
    if (revenueType === "dd") row.ddActual += Number(payment.amount || 0);
    if (revenueType === "pos") row.posActual += Number(payment.amount || 0);
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

function findClub(payment) {
  const haystack = [
    payment.description,
    payment.metadata?.siteName,
    payment.metadata?.site_name,
    payment.metadata?.locationName,
    payment.metadata?.location_name,
    payment.metadata?.club,
    payment.metadata?.clubName,
    payment.client?.homeLocationName,
    payment.client?.home_location_name,
    payment.client?.homeLocationId,
    payment.client?.home_location_id,
    payment.metadata?.siteId,
    payment.metadata?.site_id,
    payment.metadata?.locationId,
    payment.metadata?.location_id
  ].filter(Boolean).join(" ");

  return CLUB_NAMES.find((club) => sameClub(haystack, club)) || null;
}

function classifyRevenue(payment) {
  const haystack = [
    payment.paymentMethod,
    payment.description,
    payment.metadata?.revenueType,
    payment.metadata?.paymentType,
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

function sameClub(value, club) {
  if (!value) return false;
  return normalizeName(value).includes(normalizeName(club));
}

function normalizeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
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
