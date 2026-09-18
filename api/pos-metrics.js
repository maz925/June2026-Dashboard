const { get, put } = require("@vercel/blob");
const { downloadCoreReportCsv } = require("./core-report.js");

const POS_VERSION = "pos-dashboard-period-v2-2026-06-10";
const STORAGE_PATH = "pos-metrics.json";
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
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    if (url.searchParams.get("stored") === "1") {
      response.status(200).json(await loadStoredPosMetrics());
      return;
    }

    assertCronAccess(request);

    const window = reportWindow(url.searchParams);
    const existing = await loadStoredPosMetrics();
    const targetLocations = locationsForRequest(url.searchParams);
    const clubs = existing.clubs.filter((row) =>
      !targetLocations.some((location) => location.club === row.club)
    );
    const failures = [];

    for (const { club, location } of targetLocations) {
      try {
        const csv = await downloadCoreReportCsv({
          locationName: location,
          dateFrom: window.dateFrom,
          dateTo: window.dateTo
        });
        clubs.push(summarisePosCsv(csv, {
          club,
          dateFrom: window.dateFrom,
          dateTo: window.dateTo,
          periodMode: window.periodMode
        }));
      } catch (error) {
        failures.push({ club, error: error.message });
      }
    }

    if (!clubs.length) {
      throw new Error(`No POS rows were calculated. Failures: ${JSON.stringify(failures)}`);
    }

    const payload = buildPayload({
      clubs: sortClubs(clubs),
      failures
    });

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
  throw new Error("Not authorised to run POS update");
}

async function loadStoredPosMetrics() {
  const result = await get(STORAGE_PATH, { access: "private", useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) {
    return buildPayload({ clubs: [], failures: [] });
  }
  return new Response(result.stream).json();
}

function buildPayload({ clubs, failures = [], dateFrom = "", dateTo = "" }) {
  const period = sharedPeriod(clubs, dateFrom, dateTo);
  const totals = clubs.reduce((sum, row) => ({
    totalSales: round2(sum.totalSales + (row.totalSales || 0)),
    transactionCount: sum.transactionCount + (row.transactionCount || 0),
    foodAndBeverage: round2(sum.foodAndBeverage + (row.foodAndBeverage || 0)),
    merchandise: round2(sum.merchandise + (row.merchandise || 0)),
    fees: round2(sum.fees + (row.fees || 0)),
    other: round2(sum.other + (row.other || 0))
  }), { totalSales: 0, transactionCount: 0, foodAndBeverage: 0, merchandise: 0, fees: 0, other: 0 });

  return {
    version: POS_VERSION,
    source: "Hapana Core Net Revenue Detail",
    updated: new Date().toISOString(),
    dateFrom: period.dateFrom,
    dateTo: period.dateTo,
    periodMode: period.periodMode,
    totals,
    clubs,
    failures
  };
}

function summarisePosCsv(csv, { club, dateFrom, dateTo, periodMode }) {
  const records = parseDelimited(csv);
  const products = new Map();
  const categoryTotals = {
    foodAndBeverage: 0,
    merchandise: 0,
    fees: 0,
    other: 0
  };
  let transactionCount = 0;
  let totalSales = 0;

  for (const record of records) {
    if (revenueBucket(record) !== "pos") continue;
    const amount = amountValue(record);
    if (!Number.isFinite(amount)) continue;

    const description = cleanProductName(field(record, ["Description", "Package Name", "Product Name"])) || "Unspecified POS";
    const category = posCategory(record);
    if (amount > 0 && isPurchase(record)) {
      const item = products.get(description) || {
        name: description,
        category,
        quantity: 0,
        sales: 0
      };
      item.quantity += 1;
      item.sales = round2(item.sales + amount);
      item.category = item.category === "Other POS" ? category : item.category;
      products.set(description, item);
    }

    categoryTotals[categoryKey(category)] = round2(categoryTotals[categoryKey(category)] + amount);
    totalSales = round2(totalSales + amount);
    transactionCount += 1;
  }

  const topProducts = [...products.values()]
    .sort((a, b) => b.quantity - a.quantity || b.sales - a.sales || a.name.localeCompare(b.name))
    .slice(0, 5);

  return {
    club,
    dateFrom,
    dateTo,
    periodMode,
    totalSales,
    transactionCount,
    foodAndBeverage: categoryTotals.foodAndBeverage,
    merchandise: categoryTotals.merchandise,
    fees: categoryTotals.fees,
    other: categoryTotals.other,
    topProducts,
    rowCount: records.length
  };
}

function revenueBucket(record) {
  const revenueType = field(record, ["Revenue Type", "RevenueType"]);
  return /membership/i.test(revenueType) ? "dd" : "pos";
}

function posCategory(record) {
  const text = [
    field(record, ["Transaction Category", "Category"]),
    field(record, ["Revenue Type", "RevenueType"]),
    field(record, ["Description", "Package Name", "Product Name"])
  ].join(" ").toLowerCase();

  if (/food|beverage|drink|water|protein|coffee|snack|bar|shake|red\s*bull|gatorade|voss|coconut|pre\s*workout/.test(text)) {
    return "Food & Beverage";
  }
  if (/merch|retail|shirt|tee|singlet|hoodie|glove|wrap|towel|bottle|bag|hat|short|uniform|apparel/.test(text)) {
    return "Merchandise";
  }
  if (/fee|casual|entry|session|drop[\s-]?in|visit|pass|surcharge|admin|dishonour|transaction/.test(text)) {
    return "Fees";
  }
  return "Other POS";
}

function isPurchase(record) {
  const paymentStatus = field(record, ["Payment Status", "Status"]);
  return !/refund|void|reversal|failed|declined/i.test(paymentStatus);
}

function categoryKey(category) {
  return {
    "Food & Beverage": "foodAndBeverage",
    Merchandise: "merchandise",
    Fees: "fees",
    "Other POS": "other"
  }[category] || "other";
}

function amountValue(record) {
  const value = field(record, ["Gross Revenue", "Gross", "Amount", "Total"]);
  if (!value) return NaN;
  const negative = /\(.+\)|^-/.test(String(value));
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const number = Number(cleaned);
  const signed = negative ? -number : number;
  return round2(signed / 1.1);
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

function locationsForRequest(params) {
  if (params.get("all") === "1") return LOCATIONS;
  const requested = params.get("club") || params.get("location");
  if (!requested) return LOCATIONS;

  const normalised = normaliseClub(requested);
  return LOCATIONS.filter(({ club, location }) =>
    normaliseClub(club) === normalised || normaliseClub(location) === normalised
  );
}

function reportWindow(params) {
  const explicitFrom = params.get("date_from");
  const explicitTo = params.get("date_to");
  if (explicitFrom && explicitTo) {
    const rolling = rollingTwelveWeekWindow();
    const isRolling = explicitFrom === rolling.dateFrom && explicitTo === rolling.dateTo;
    return {
      dateFrom: explicitFrom,
      dateTo: explicitTo,
      periodMode: isRolling ? "rolling12Weeks" : "custom"
    };
  }

  return rollingTwelveWeekWindow();
}

function rollingTwelveWeekWindow() {
  const today = sydneyCalendarDate();
  const day = today.getUTCDay();
  const daysSinceThursday = (day - 4 + 7) % 7;
  const latestClosedThursday = addDays(today, -daysSinceThursday);
  const end = addDays(latestClosedThursday, -7);
  const start = addDays(end, -83);
  return {
    dateFrom: hapanaDate(start),
    dateTo: hapanaDate(end),
    periodMode: "rolling12Weeks"
  };
}

function sharedPeriod(clubs, fallbackFrom, fallbackTo) {
  const periods = [...new Set(clubs.map((row) =>
    `${row.dateFrom || fallbackFrom || ""}|${row.dateTo || fallbackTo || ""}|${row.periodMode || "rolling12Weeks"}`
  ))].filter((value) => value !== "||rolling12Weeks");

  if (periods.length === 1) {
    const [dateFrom, dateTo, periodMode] = periods[0].split("|");
    return { dateFrom, dateTo, periodMode };
  }

  if (!periods.length) {
    return { dateFrom: fallbackFrom, dateTo: fallbackTo, periodMode: "rolling12Weeks" };
  }

  return { dateFrom: "", dateTo: "", periodMode: "mixed" };
}

function sortClubs(clubs) {
  const order = new Map(LOCATIONS.map((row, index) => [row.club, index]));
  return [...clubs].sort((a, b) => (order.get(a.club) ?? 99) - (order.get(b.club) ?? 99));
}

function cleanProductName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normaliseHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normaliseClub(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^ufc\s+gym\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
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
