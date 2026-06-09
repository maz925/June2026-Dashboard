const { get, put } = require("@vercel/blob");
const { downloadCoreReportCsv } = require("./core-report.js");

const WEEKLY_REVENUE_VERSION = "weekly-revenue-club-refresh-v4-2026-06-09";
const STORAGE_PATH = "weekly-revenue.json";
const TIME_ZONE = "Australia/Sydney";

const LOCATIONS = [
  { club: "Bankstown", location: "UFC GYM Bankstown" },
  { club: "Wetherill Park", location: "UFC GYM Wetherill Park" },
  { club: "580G", location: "580G" },
  { club: "Woolooware", location: "UFC GYM Woolooware" }
];

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (!["GET", "POST"].includes(request.method)) {
    response.status(405).json({ error: "Only GET and POST are supported" });
    return;
  }

  try {
    assertCronAccess(request);

    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const window = reportWindow(url.searchParams);
    const targetLocations = locationsForRequest(url.searchParams);
    const rows = [];
    const failures = [];

    for (const { club, location } of targetLocations) {
      try {
        const csv = await downloadCoreReportCsv({
          locationName: location,
          dateFrom: window.dateFrom,
          dateTo: window.dateTo
        });
        rows.push(summariseCsv(csv, {
          club,
          weekEnding: window.weekEnding,
          dateFrom: window.dateFrom,
          dateTo: window.dateTo
        }));
      } catch (error) {
        failures.push({ club, error: error.message });
      }
    }

    if (!rows.length) {
      throw new Error(`No weekly revenue rows were calculated. Failures: ${JSON.stringify(failures)}`);
    }

    const existing = await loadExistingWeeklyRevenue();
    const rolling = mergeRollingRows(existing?.rolling || [], rows);
    const payload = {
      version: WEEKLY_REVENUE_VERSION,
      source: "Hapana Core Net Revenue Detail",
      updated: new Date().toISOString(),
      weekEnding: window.weekEnding,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      rolling,
      failures
    };

    const blob = await put(STORAGE_PATH, JSON.stringify(payload, null, 2), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json"
    });

    response.status(failures.length ? 207 : 200).json({
      ...payload,
      stored: true,
      blobUrl: blob?.url || null
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};

function assertCronAccess(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;

  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const auth = request.headers.authorization || request.headers.Authorization || "";
  const querySecret = url.searchParams.get("secret");

  if (auth === `Bearer ${secret}` || querySecret === secret) return;
  throw new Error("Not authorised to run weekly revenue update");
}

function locationsForRequest(params) {
  if (params.get("all") === "1") return LOCATIONS;
  const requested = params.get("club") || params.get("location");
  if (!requested) return LOCATIONS;

  const normalised = normaliseClub(requested);
  return LOCATIONS.filter(({ club, location }) =>
    normaliseClub(club) === normalised || normaliseClub(location) === normalised
  );
}

function normaliseClub(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^ufc\s+gym\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

async function loadExistingWeeklyRevenue() {
  const result = await get(STORAGE_PATH, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return new Response(result.stream).json();
}

function mergeRollingRows(existingRows, newRows) {
  const rowsByKey = new Map();
  for (const row of existingRows) {
    if (row?.weekEnding && row?.club) rowsByKey.set(`${row.weekEnding}|${row.club}`, row);
  }
  for (const row of newRows) {
    if (row?.weekEnding && row?.club) rowsByKey.set(`${row.weekEnding}|${row.club}`, row);
  }
  return [...rowsByKey.values()].sort((a, b) =>
    String(a.weekEnding).localeCompare(String(b.weekEnding)) ||
    String(a.club).localeCompare(String(b.club))
  );
}

function reportWindow(params) {
  const explicitFrom = params.get("date_from");
  const explicitTo = params.get("date_to");
  if (explicitFrom && explicitTo) {
    return {
      dateFrom: explicitFrom,
      dateTo: explicitTo,
      weekEnding: parseHapanaDate(explicitTo).toISOString().slice(0, 10)
    };
  }

  const today = sydneyCalendarDate();
  const day = today.getUTCDay();
  const daysSinceThursday = (day - 4 + 7) % 7;
  const latestClosedThursday = addDays(today, -daysSinceThursday);
  const end = addDays(latestClosedThursday, -7);
  const start = addDays(end, -6);

  return {
    dateFrom: hapanaDate(start),
    dateTo: hapanaDate(end),
    weekEnding: end.toISOString().slice(0, 10)
  };
}

function summariseCsv(csv, { club, weekEnding, dateFrom, dateTo }) {
  const records = parseDelimited(csv);
  let ddActual = 0;
  let posActual = 0;

  for (const record of records) {
    const amount = amountValue(record);
    if (!Number.isFinite(amount)) continue;

    const bucket = revenueBucket(record);
    if (bucket === "pos") posActual += amount;
    if (bucket === "dd") ddActual += amount;
  }

  return {
    weekEnding,
    dateFrom,
    dateTo,
    club,
    ddActual: round2(ddActual),
    ddTarget: null,
    ddGap: null,
    posActual: round2(posActual),
    posTarget: null,
    posPercent: ddActual ? round1((posActual / ddActual) * 100) : null,
    targetPercent: null,
    status: "",
    rowCount: records.length
  };
}

function revenueBucket(record) {
  const revenueType = field(record, ["Revenue Type", "RevenueType"]);
  return /membership/i.test(revenueType) ? "dd" : "pos";
}

function amountValue(record) {
  const value = field(record, ["Gross Revenue", "Gross", "Amount", "Total"]);
  if (!value) return NaN;
  const negative = /\(.+\)|^-/.test(String(value));
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const number = Number(cleaned);
  const signed = negative ? -number : number;
  return signed / 1.1;
}

function field(record, names) {
  for (const name of names) {
    const key = Object.keys(record).find((candidate) =>
      normaliseHeader(candidate) === normaliseHeader(name)
    );
    if (key) return record[key];
  }
  return "";
}

function parseDelimited(input) {
  const text = String(input || "").replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  const delimiter = delimiterFor(text);
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      current = "";
      row = [];
    } else {
      current += char;
    }
  }

  row.push(current);
  rows.push(row);

  const nonEmpty = rows.filter((values) => values.some((value) => String(value).trim()));
  const headers = nonEmpty.shift()?.map((value) => String(value).trim()) || [];

  return nonEmpty.map((values) => Object.fromEntries(headers.map((header, index) => [
    header,
    values[index] || ""
  ])));
}

function delimiterFor(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function normaliseHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sydneyCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

function parseHapanaDate(value) {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function hapanaDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}
