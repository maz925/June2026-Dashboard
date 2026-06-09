const { get, put } = require("@vercel/blob");
const {
  ACCOUNT_LIST_URL,
  createCoreSession,
  downloadCoreReportCsv,
  requestWithCookies
} = require("./core-report.js");

const DEFAULT_HAPANA_BASE_URL = "https://api.hapana.com/v2";
const MEMBER_METRICS_VERSION = "member-metrics-cancel-date-forecast-v17-2026-06-09";
const STORAGE_PATH = "member-metrics.json";
const TIME_ZONE = "Australia/Sydney";

const LOCATIONS = [
  { club: "Bankstown", location: "UFC GYM Bankstown", siteID: "Z0R6ZkxvWThJWGxEeUxnd2UyY2tKdz09" },
  { club: "Wetherill Park", location: "UFC GYM Wetherill Park", siteID: "UWNnS2tUM3VDeUN0YTlaWlBDM3lqdz09" },
  { club: "580G", location: "UFC GYM 580 George", siteID: "QTBOOHBBZDRFL3F5QjNBcTJaZHdxUT09" },
  { club: "Woolooware", location: "UFC GYM Woolooware", siteID: "RTM4ZWdHWjNnVUdPeXl4TDlmWVFVUT09" }
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
    if (url.searchParams.get("stored") === "1") {
      const stored = await loadExistingMemberMetrics();
      response.status(200).json(stored || emptyPayload());
      return;
    }

    const window = monthWindow(url.searchParams);
    const debug = url.searchParams.get("debug");
    const source = url.searchParams.get("source") || "core";
    const targetLocations = locationsForRequest(url.searchParams);

    if (!targetLocations.length) {
      const stored = await loadExistingMemberMetrics();
      response.status(200).json(stored || {
        ...emptyPayload(),
        note: "No club was requested. Use /api/member-metrics?club=Bankstown, Wetherill%20Park, 580G, or Woolooware."
      });
      return;
    }

    const rows = [];
    const failures = [];
    const samples = [];
    const existing = await loadExistingMemberMetrics();
    const existingClubs = existing?.dateFrom === window.dateFrom && existing?.dateTo === window.dateTo
      ? existing.clubs || []
      : [];

    for (const locationConfig of targetLocations) {
      const { club, location } = locationConfig;
      try {
        if (source !== "core") {
          const row = await livePublicApiRow(locationConfig, window, debug);
          rows.push({
            ...(existingClubs.find((existingRow) => existingRow.club === club) || {}),
            ...row
          });
          if (debug === "public") samples.push(row.debug);
          continue;
        }

        const csv = await downloadCoreReportCsv({
          locationName: location,
          dateFrom: window.dateFrom,
          dateTo: window.dateTo,
          reportKey: "membershipDetail"
        });
        const records = parseDelimited(csv);
        rows.push(summariseRecords(records, { club, dateFrom: window.dateFrom, dateTo: window.dateTo }));

        if (debug === "headers") {
          samples.push({
            club,
            headers: Object.keys(records[0] || {}),
            firstRows: records.slice(0, 3)
          });
        }
      } catch (error) {
        failures.push({ club, error: errorText(error) });
      }
    }

    if (debug === "headers") {
      response.status(200).json({
        version: MEMBER_METRICS_VERSION,
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
        samples,
        failures
      });
      return;
    }

    if (!rows.length && !existingClubs.length) {
      throw new Error(`No member rows were calculated. Failures: ${JSON.stringify(failures)}`);
    }

    const clubs = mergeClubRows(existingClubs, rows);

    const payload = {
      version: MEMBER_METRICS_VERSION,
      source: source === "core" ? "Hapana Core Membership Detail" : "Hapana Public API Clients",
      updated: new Date().toISOString(),
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      monthKey: window.monthKey,
      clubs,
      totals: totalRows(clubs),
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
    response.status(500).json({ error: errorText(error) });
  }
};

function assertCronAccess(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;

  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const auth = request.headers.authorization || request.headers.Authorization || "";
  const querySecret = url.searchParams.get("secret");

  if (auth === `Bearer ${secret}` || querySecret === secret) return;
  throw new Error("Not authorised to run member metrics update");
}

async function loadExistingMemberMetrics() {
  const result = await get(STORAGE_PATH, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return new Response(result.stream).json();
}

function emptyPayload() {
  return {
    version: MEMBER_METRICS_VERSION,
    source: "Hapana Core Membership Detail",
    updated: null,
    clubs: [],
    totals: totalRows([]),
    failures: [],
    note: "No stored member metrics have been written yet. Run /api/member-metrics first."
  };
}

function locationsForRequest(params) {
  if (params.get("all") === "1") return LOCATIONS;
  const requested = params.get("club") || params.get("location");
  if (!requested) return [];

  const normalised = normaliseClub(requested);
  return LOCATIONS.filter(({ club, location }) =>
    normaliseClub(club) === normalised || normaliseClub(location) === normalised
  );
}

function mergeClubRows(existingRows, newRows) {
  const rowsByClub = new Map();
  for (const row of existingRows) {
    if (row?.club) rowsByClub.set(row.club, row);
  }
  for (const row of newRows) {
    if (row?.club) rowsByClub.set(row.club, row);
  }
  return LOCATIONS
    .map(({ club }) => rowsByClub.get(club))
    .filter(Boolean);
}

async function livePublicApiRow({ club, siteID }, window, debug) {
  const clients = await listClients(siteID);
  const classified = clients.map(classifyClientActive);
  const unknown = classified.filter((item) => item.active === null);

  if (clients.length && unknown.length === clients.length) {
    throw new Error(`Hapana Public API client rows for ${club} do not include a recognisable active/status field`);
  }

  const activeMembers = classified.filter((item) => item.active).length;
  const days = dateRange(parseHapanaDate(window.dateFrom), parseHapanaDate(window.dateTo));

  return {
    club,
    activeMembers,
    standardActiveMembers: activeMembers,
    fitnessPassportMembers: 0,
    cancellations: 0,
    suspensions: 0,
    newMemberships: 0,
    dailyActive: days.map((date) => ({
      date: date.toISOString().slice(0, 10),
      active: activeMembers
    })),
    rowCount: clients.length,
    liveSource: "hapana-public-api-clients",
    ...(debug === "public" ? {
      debug: {
        club,
        siteID,
        rowCount: clients.length,
        activeMembers,
        unknownStatusRows: unknown.length,
        sampleKeys: Object.keys(clients[0] || {}),
        statusSamples: classified.slice(0, 5).map((item) => item.evidence)
      }
    } : {})
  };
}

async function listClients(siteID) {
  const pageSize = Number(process.env.HAPANA_CLIENT_PAGE_SIZE || 500);
  const maxPages = Number(process.env.HAPANA_CLIENT_MAX_PAGES || 100);
  const clients = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const url = publicApiUrl("/customer/client");
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("pageIndex", String(pageIndex));

    const body = await hapanaGet(url, siteID);
    const page = Array.isArray(body.data) ? body.data : [];
    clients.push(...page);

    if (!page.length || page.length < pageSize || body.hasMore === false || body.has_more === false) break;
  }

  return clients;
}

async function hapanaGet(url, siteID = "") {
  const accessID = process.env.HAPANA_ACCESS_ID;
  if (!accessID) throw new Error("HAPANA_ACCESS_ID is not configured");

  const headers = {
    "Accept": "application/json",
    "accessID": accessID
  };
  if (siteID) headers.siteID = siteID;

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) throw new Error(`Hapana Public API request failed: ${response.status}`);

  const body = await response.json();
  if (body.success === false || body.code >= 400) {
    throw new Error(body.message || `Hapana Public API returned ${body.code}`);
  }

  return body;
}

function publicApiUrl(path) {
  const baseUrl = process.env.HAPANA_BASE_URL || DEFAULT_HAPANA_BASE_URL;
  return new URL(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
}

function classifyClientActive(client) {
  const candidates = [
    "status",
    "clientStatus",
    "client_status",
    "memberStatus",
    "member_status",
    "membershipStatus",
    "membership_status",
    "packageStatus",
    "package_status",
    "state",
    "isActive",
    "active"
  ];

  for (const key of candidates) {
    const value = getPath(client, key);
    if (value === undefined || value === null || value === "") continue;
    const active = activeValue(value);
    if (active !== null) return { active, evidence: { key, value } };
  }

  const flattened = flattenObject(client);
  for (const [key, value] of Object.entries(flattened)) {
    if (!/(status|active|state)/i.test(key)) continue;
    const active = activeValue(value);
    if (active !== null) return { active, evidence: { key, value } };
  }

  return { active: null, evidence: null };
}

function activeValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;

  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (["active", "current", "open", "ok", "yes", "true", "1"].includes(text)) return true;
  if (/^(inactive|cancelled|canceled|complete|completed|suspended|pending|scheduled|expired|deleted|terminated|false|no|0)$/.test(text)) return false;
  return null;
}

function getPath(object, key) {
  return key.split(".").reduce((value, part) => value?.[part], object);
}

function flattenObject(value, prefix = "", output = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenObject(child, path, output);
    } else {
      output[path] = child;
    }
  }
  return output;
}

async function activeFallbackRow(club, window) {
  const jar = await createCoreSession();
  const accountPage = await requestWithCookies(jar, ACCOUNT_LIST_URL);
  const html = await accountPage.text();
  const activeMembers = activeCountFromAccountList(html, club);
  if (!Number.isFinite(activeMembers)) return null;

  const days = dateRange(parseHapanaDate(window.dateFrom), parseHapanaDate(window.dateTo));
  return {
    club,
    activeMembers,
    cancellations: 0,
    suspensions: 0,
    newMemberships: 0,
    dailyActive: days.map((date) => ({
      date: date.toISOString().slice(0, 10),
      active: activeMembers
    })),
    rowCount: 0,
    fallback: "account-list-active-count"
  };
}

function activeCountFromAccountList(html, club) {
  const names = locationNamesForClub(club);
  const lowerHtml = String(html || "").toLowerCase();
  const tableStart = Math.max(
    lowerHtml.indexOf("hapana accounts"),
    lowerHtml.indexOf("business name"),
    lowerHtml.indexOf("businesslist")
  );
  const scopedHtml = tableStart >= 0 ? String(html).slice(tableStart) : String(html);

  for (const name of names) {
    const index = scopedHtml.toLowerCase().indexOf(name.toLowerCase());
    if (index < 0) continue;

    const row = containingElement(scopedHtml, index, "li")
      || containingElement(scopedHtml, index, "tr")
      || containingElement(scopedHtml, index, "div")
      || scopedHtml.slice(Math.max(0, index - 600), index + 1200);
    const text = textSnippet(row);

    const clientsMatch = text.match(/Clients\s*:?\s*([0-9,]+)/i);
    if (clientsMatch) return Number(clientsMatch[1].replace(/,/g, ""));

    const numbers = [...text.matchAll(/\b([0-9]{2,6})\b/g)].map((match) => Number(match[1]));
    if (numbers.length) return Math.max(...numbers);
  }

  return NaN;
}

function locationNamesForClub(club) {
  return {
    "Bankstown": ["UFC GYM Bankstown", "Bankstown"],
    "Wetherill Park": ["UFC GYM Wetherill Park", "Wetherill Park", "Wetherill"],
    "580G": ["UFC GYM 580 George", "580 George", "George St", "George Street", "580G"],
    "Woolooware": ["UFC GYM Woolooware", "Woolooware"]
  }[club] || [club];
}

function containingElement(html, index, tagName) {
  const open = new RegExp(`<${tagName}\\b`, "ig");
  let rowStart = -1;
  let match;

  while ((match = open.exec(html)) && match.index <= index) {
    rowStart = match.index;
  }

  if (rowStart < 0) return "";

  const closeToken = `</${tagName}>`;
  const rowEnd = html.toLowerCase().indexOf(closeToken, index);
  return rowEnd >= 0 ? html.slice(rowStart, rowEnd + closeToken.length) : "";
}

function normaliseClub(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^ufc\s+gym\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function monthWindow(params) {
  const explicitFrom = params.get("date_from");
  const explicitTo = params.get("date_to");
  if (explicitFrom && explicitTo) {
    return {
      dateFrom: explicitFrom,
      dateTo: explicitTo,
      monthKey: parseHapanaDate(explicitTo).toISOString().slice(0, 7)
    };
  }

  const today = sydneyCalendarDate();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return {
    dateFrom: hapanaDate(start),
    dateTo: hapanaDate(today),
    monthKey: today.toISOString().slice(0, 7)
  };
}

function summariseRecords(records, { club, dateFrom, dateTo }) {
  const start = parseHapanaDate(dateFrom);
  const end = parseHapanaDate(dateTo);
  const windows = movementWindows(end);
  const cancellationWindows = cancellationForecastWindows(end);
  const days = dateRange(start, end);
  let active = 0;
  let fitnessPassport = 0;
  let cancellations = 0;
  let suspensions = 0;
  let newMemberships = 0;
  const movement = emptyMovement(windows);
  const cancellationForecast = emptyCancellationForecast(cancellationWindows);

  const dailyActive = days.map((date) => ({
    date: date.toISOString().slice(0, 10),
    active: 0
  }));

  for (const record of records) {
    const status = field(record, ["Package Status", "Membership Status", "Status", "Client Status", "Member Status"]);
    const packageName = field(record, ["Package Name", "Membership Name", "Product Name"]);
    const packageCategory = field(record, ["Package Category", "Membership Category", "Product Category"]);
    const startDate = bestDate(record, ["Start Date", "Membership Start Date", "Contract Start Date", "Sale Date", "Sold Date", "Purchase Date", "Created Date", "Join Date", "Date Sold", "Member Created Date"]);
    const soldDate = bestDate(record, ["Date Sold", "Sale Date", "Sold Date", "Purchase Date", "Created Date", "Member Created Date", "Join Date"]);
    const cancelDate = bestDate(record, ["Cancel Date", "Cancelled Date", "Cancellation Date", "Terminated Date", "End Date"]);
    const suspendDate = bestDate(record, ["Suspension Date", "Suspended Date", "Freeze Date", "Frozen Date", "Hold Date", "Member Inactive Date"]);

    const activeStatus = isActiveStatus(status, cancelDate, end);
    if (activeStatus) {
      active += 1;
      if (isFitnessPassport(packageName)) fitnessPassport += 1;
    }
    if (inRange(cancelDate, start, end) || /cancel|terminat/i.test(status)) cancellations += 1;
    if (inRange(suspendDate, start, end) || /suspend|freeze|frozen|hold/i.test(status)) suspensions += 1;
    if (isNewSale({ status, packageName, packageCategory, soldDate, startDate, cancelDate, windowStart: start, windowEnd: end })) newMemberships += 1;
    addCancellationForecast(cancellationForecast, cancellationWindows, cancelDate);
    addMovement(movement, windows, {
      status,
      packageName,
      packageCategory,
      soldDate,
      cancelDate,
      suspendDate,
      startDate
    });

    dailyActive.forEach((point) => {
      const pointDate = new Date(`${point.date}T00:00:00Z`);
      if (isActiveOnDate({ status, startDate, cancelDate }, pointDate)) point.active += 1;
    });
  }

  return {
    club,
    activeMembers: active,
    standardActiveMembers: Math.max(0, active - fitnessPassport),
    fitnessPassportMembers: fitnessPassport,
    cancellations,
    suspensions,
    newMemberships,
    movement,
    cancellationForecast,
    dailyActive,
    rowCount: records.length
  };
}

function totalRows(rows) {
  const byDate = new Map();
  for (const row of rows) {
    for (const point of row.dailyActive || []) {
      byDate.set(point.date, (byDate.get(point.date) || 0) + (point.active || 0));
    }
  }

  return {
    activeMembers: rows.reduce((sum, row) => sum + (row.activeMembers || 0), 0),
    standardActiveMembers: rows.reduce((sum, row) => sum + (row.standardActiveMembers ?? Math.max(0, (row.activeMembers || 0) - (row.fitnessPassportMembers || 0))), 0),
    fitnessPassportMembers: rows.reduce((sum, row) => sum + (row.fitnessPassportMembers || 0), 0),
    cancellations: rows.reduce((sum, row) => sum + (row.cancellations || 0), 0),
    suspensions: rows.reduce((sum, row) => sum + (row.suspensions || 0), 0),
    newMemberships: rows.reduce((sum, row) => sum + (row.newMemberships || 0), 0),
    movement: totalMovement(rows),
    cancellationForecast: totalCancellationForecast(rows),
    dailyActive: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, active]) => ({ date, active }))
  };
}

function movementWindows(end) {
  const currentStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const previousStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  const previousEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0));
  return {
    previousMonth: {
      label: previousStart.toISOString().slice(0, 7),
      dateFrom: hapanaDate(previousStart),
      dateTo: hapanaDate(previousEnd),
      start: previousStart,
      end: previousEnd
    },
    currentMonthToDate: {
      label: end.toISOString().slice(0, 7),
      dateFrom: hapanaDate(currentStart),
      dateTo: hapanaDate(end),
      start: currentStart,
      end
    }
  };
}

function emptyMovement(windows) {
  return Object.fromEntries(Object.entries(windows).map(([key, window]) => [
    key,
    {
      label: window.label,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      newSales: 0,
      standardNewSales: 0,
      fitnessPassportNewSales: 0,
      cancellations: 0,
      suspensions: 0
    }
  ]));
}

function addMovement(movement, windows, { status, packageName, packageCategory, soldDate, cancelDate, suspendDate, startDate }) {
  for (const [key, window] of Object.entries(windows)) {
    if (isNewSale({ status, packageName, packageCategory, soldDate, startDate, cancelDate, windowStart: window.start, windowEnd: window.end })) {
      movement[key].newSales += 1;
      if (isFitnessPassport(packageName)) {
        movement[key].fitnessPassportNewSales += 1;
      } else {
        movement[key].standardNewSales += 1;
      }
    }
    if (inRange(cancelDate, window.start, window.end) || (/cancel|terminat/i.test(status) && inRange(cancelDate || startDate, window.start, window.end))) {
      movement[key].cancellations += 1;
    }
    if (inRange(suspendDate, window.start, window.end) || (/suspend|freeze|frozen|hold/i.test(status) && inRange(suspendDate || startDate, window.start, window.end))) {
      movement[key].suspensions += 1;
    }
  }
}

function totalMovement(rows) {
  const movement = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.movement || {})) {
      movement[key] ||= {
        label: value.label,
        dateFrom: value.dateFrom,
        dateTo: value.dateTo,
        newSales: 0,
        standardNewSales: 0,
        fitnessPassportNewSales: 0,
        cancellations: 0,
        suspensions: 0
      };
      movement[key].newSales += value.newSales || 0;
      movement[key].standardNewSales += value.standardNewSales ?? Math.max(0, (value.newSales || 0) - (value.fitnessPassportNewSales || 0));
      movement[key].fitnessPassportNewSales += value.fitnessPassportNewSales || 0;
      movement[key].cancellations += value.cancellations || 0;
      movement[key].suspensions += value.suspensions || 0;
    }
  }
  return movement;
}

function cancellationForecastWindows(end) {
  const currentStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const currentEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0));
  const nextStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1));
  const nextEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 2, 0));
  return {
    currentMonth: {
      label: currentStart.toISOString().slice(0, 7),
      dateFrom: hapanaDate(currentStart),
      dateTo: hapanaDate(currentEnd),
      start: currentStart,
      end: currentEnd
    },
    nextMonth: {
      label: nextStart.toISOString().slice(0, 7),
      dateFrom: hapanaDate(nextStart),
      dateTo: hapanaDate(nextEnd),
      start: nextStart,
      end: nextEnd
    }
  };
}

function emptyCancellationForecast(windows) {
  return Object.fromEntries(Object.entries(windows).map(([key, window]) => [
    key,
    {
      label: window.label,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      cancellations: 0
    }
  ]));
}

function addCancellationForecast(forecast, windows, cancelDate) {
  for (const [key, window] of Object.entries(windows)) {
    if (inRange(cancelDate, window.start, window.end)) forecast[key].cancellations += 1;
  }
}

function totalCancellationForecast(rows) {
  const forecast = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.cancellationForecast || {})) {
      forecast[key] ||= {
        label: value.label,
        dateFrom: value.dateFrom,
        dateTo: value.dateTo,
        cancellations: 0
      };
      forecast[key].cancellations += value.cancellations || 0;
    }
  }
  return forecast;
}

function isActiveStatus(status, cancelDate, end) {
  const text = String(status || "").toLowerCase();
  if (cancelDate && cancelDate <= end) return false;
  return text === "active";
}

function isNewSale({ status, packageName, packageCategory, soldDate, startDate, cancelDate, windowStart, windowEnd }) {
  const saleDate = soldDate || startDate;
  return isActiveStatus(status, cancelDate, windowEnd)
    && isOperatingClubMembership(packageCategory)
    && !isExcludedNewSalePackage(packageName)
    && inRange(saleDate, windowStart, windowEnd);
}

function isOperatingClubMembership(packageCategory) {
  return normaliseHeader(packageCategory) === "operatingclubmemberships";
}

function isExcludedNewSalePackage(packageName) {
  return normaliseHeader(packageName) === "questguestexperience";
}

function isFitnessPassport(packageName) {
  return /fitness\s*passport/i.test(String(packageName || ""));
}

function isActiveOnDate({ status, startDate, cancelDate }, date) {
  if (startDate && startDate > date) return false;
  if (cancelDate && cancelDate <= date) return false;
  return isActiveStatus(status, cancelDate, date);
}

function bestDate(record, names) {
  for (const name of names) {
    const value = field(record, [name]);
    const date = parseLooseDate(value);
    if (date) return date;
  }
  return null;
}

function inRange(date, start, end) {
  return Boolean(date && date >= start && date <= end);
}

function dateRange(start, end) {
  const dates = [];
  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    dates.push(new Date(date));
  }
  return dates;
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

function parseLooseDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (dmy) {
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    return new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1])));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  return null;
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

function textSnippet(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function errorText(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return String(error);
  }
}
