const { get, put } = require("@vercel/blob");
const {
  downloadCoreAdvancedReportCsv,
  downloadCoreReportCsv
} = require("./core-report.js");

const FITNESS_METRICS_VERSION = "fitness-metrics-hapana-v1-2026-09-10";
const STORAGE_PATH = "fitness-metrics.json";
const TARGETS_STORAGE_PATH = "fitness-targets.json";
const WEEKLY_REVENUE_STORAGE_PATH = "weekly-revenue.json";
const TIME_ZONE = "Australia/Sydney";

const LOCATIONS = [
  { club: "Bankstown", location: "UFC GYM Bankstown" },
  { club: "Wetherill Park", location: "UFC GYM Wetherill Park" },
  { club: "580G", location: "580G" },
  { club: "Woolooware", location: "UFC GYM Woolooware" }
];

const KPI_GROUPS = [
  {
    title: "Class Participation Ratio",
    kpis: [
      { key: "totalCheckins", label: "Total Check-ins", type: "number", target: "minimum" },
      { key: "totalClassAttendance", label: "Total Class Attendance", type: "number", target: "minimum" },
      { key: "totalClassCapacity", label: "Total Class Capacity", type: "number", target: "reference" },
      { key: "classParticipationRatio", label: "Class Participation Ratio", type: "percent", target: "minimum" }
    ]
  },
  {
    title: "PT Packs Sold / PT Sessions Split Revenue",
    kpis: [
      { key: "ptMmaPacksSold", label: "PT Packs Sold", type: "number", target: "minimum" },
      { key: "paidPtSessions", label: "Paid PT Sessions Performed", type: "number", target: "minimum" },
      { key: "posRevenue", label: "Total Revenue Collected at POS", type: "money", target: "minimum" },
      { key: "sessionSplitIncome", label: "Total Revenue from Sessions-Split Income", type: "money", target: "minimum" }
    ]
  },
  {
    title: "PT Rent Income",
    kpis: [
      { key: "activePts", label: "Current Active PTs", type: "number", target: "minimum" },
      { key: "ptRentCollected", label: "Current PT Rent Collected", type: "money", target: "minimum" }
    ]
  },
  {
    title: "Number Class Performed",
    kpis: [
      { key: "conditioningClassCosts", label: "Total Conditioning Classes $", type: "money", target: "maximum" },
      { key: "skillsClassCosts", label: "Total Skills Classes $", type: "money", target: "maximum" },
      { key: "paidClassCosts", label: "Total Paid Class Costs", type: "money", target: "maximum" },
      { key: "classCostBudget", label: "Budget", type: "money", target: "reference" }
    ]
  }
];

const DEFAULT_TARGETS = {
  "Bankstown": { totalCheckins: 7600, totalClassAttendance: 3000, totalClassCapacity: 0, classParticipationRatio: 39, ptMmaPacksSold: 26, paidPtSessions: 205, posRevenue: 21000, sessionSplitIncome: 14000, activePts: 10, ptRentCollected: 7800, conditioningClassCosts: 4100, skillsClassCosts: 3100, paidClassCosts: 7200, classCostBudget: 7200 },
  "Wetherill Park": { totalCheckins: 7500, totalClassAttendance: 3300, totalClassCapacity: 0, classParticipationRatio: 42, ptMmaPacksSold: 29, paidPtSessions: 225, posRevenue: 23500, sessionSplitIncome: 15800, activePts: 12, ptRentCollected: 9300, conditioningClassCosts: 4600, skillsClassCosts: 3500, paidClassCosts: 8300, classCostBudget: 8300 },
  "580G": { totalCheckins: 6200, totalClassAttendance: 2300, totalClassCapacity: 0, classParticipationRatio: 37, ptMmaPacksSold: 22, paidPtSessions: 175, posRevenue: 18000, sessionSplitIncome: 12000, activePts: 8, ptRentCollected: 6400, conditioningClassCosts: 3500, skillsClassCosts: 2800, paidClassCosts: 6200, classCostBudget: 6200 },
  "Woolooware": { totalCheckins: 6600, totalClassAttendance: 2550, totalClassCapacity: 0, classParticipationRatio: 39, ptMmaPacksSold: 25, paidPtSessions: 185, posRevenue: 19000, sessionSplitIncome: 12800, activePts: 9, ptRentCollected: 7000, conditioningClassCosts: 3900, skillsClassCosts: 3000, paidClassCosts: 6900, classCostBudget: 6900 }
};

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
      response.status(200).json(await loadStoredFitnessMetrics());
      return;
    }

    assertCronAccess(request);

    const window = await fitnessWindow(url.searchParams);
    const targetLocations = locationsForRequest(url.searchParams);
    const existing = await loadStoredFitnessMetrics();
    const targetOverrides = await loadStoredFitnessTargets();
    const rows = [];
    const failures = [];

    for (const { club, location } of targetLocations) {
      try {
        const csv = await downloadCoreReportCsv({
          locationName: location,
          dateFrom: window.dateFrom,
          dateTo: window.dateTo
        });
        rows.push(await buildFitnessRow(csv, { club, location, window, targetOverrides }));
      } catch (error) {
        failures.push({ club, error: errorText(error) });
      }
    }

    const successfulClubs = new Set(rows.map((row) => row.club));
    const previousRows = existing.rows.filter((row) =>
      !samePeriodWindow(row, window) || !successfulClubs.has(row.club)
    );

    if (!rows.length && !previousRows.length) {
      throw new Error(`No Fitness KPI rows were calculated. Failures: ${JSON.stringify(failures)}`);
    }

    const payload = buildPayload({
      rows: sortRows(previousRows.concat(rows)),
      failures,
      window
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
  throw new Error("Not authorised to run Fitness metrics update");
}

async function loadStoredFitnessMetrics() {
  const result = await get(STORAGE_PATH, { access: "private", useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) return emptyPayload();
  return new Response(result.stream).json();
}

async function loadStoredFitnessTargets() {
  const result = await get(TARGETS_STORAGE_PATH, { access: "private", useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) return {};
  const payload = await new Response(result.stream).json().catch(() => ({}));
  return payload.targets || {};
}

function emptyPayload() {
  return buildPayload({
    rows: [],
    failures: [],
    window: fallbackWeekWindow()
  });
}

function buildPayload({ rows, failures = [], window }) {
  return {
    version: FITNESS_METRICS_VERSION,
    source: "Hapana Core Net Revenue Detail",
    updated: rows.length ? new Date().toISOString() : null,
    periods: periodsFromRows(rows, window),
    clubs: LOCATIONS.map((location) => location.club),
    kpiGroups: KPI_GROUPS,
    rows,
    failures
  };
}

function periodsFromRows(rows, currentWindow) {
  const rowPeriods = [...new Map(rows.map((row) => [row.period, {
    id: row.period,
    label: row.periodLabel,
    range: row.periodRange,
    periodMode: row.periodMode,
    dateFrom: row.dateFrom,
    dateTo: row.dateTo
  }])).values()];
  const fallback = {
    id: currentWindow.period,
    label: currentWindow.label,
    range: currentWindow.range,
    periodMode: currentWindow.periodMode,
    dateFrom: currentWindow.dateFrom,
    dateTo: currentWindow.dateTo
  };
  return rowPeriods.length ? rowPeriods.sort((a, b) => b.id.localeCompare(a.id)) : [fallback];
}

async function buildFitnessRow(csv, { club, location, window, targetOverrides = {} }) {
  const records = parseDelimited(csv);
  const actuals = summariseNetRevenue(records);
  const reportNotes = [];
  const targets = targetsForClub(club, targetOverrides);

  const participation = await optionalParticipationMetrics({ location, window }).catch((error) => {
    reportNotes.push(error.message);
    return {};
  });
  const classCosts = await optionalClassCostMetrics({ location, window }).catch((error) => {
    reportNotes.push(error.message);
    return {};
  });

  Object.assign(actuals, participation, classCosts);
  actuals.classParticipationRatio = actuals.totalCheckins
    ? round1((actuals.totalClassAttendance / actuals.totalCheckins) * 100)
    : 0;
  actuals.totalClassCapacity = targets.totalClassCapacity || 0;
  actuals.paidClassCosts = round2((actuals.conditioningClassCosts || 0) + (actuals.skillsClassCosts || 0)) || actuals.paidClassCosts || 0;
  actuals.classCostBudget = targets.classCostBudget || 0;

  return {
    period: window.period,
    periodLabel: window.label,
    periodRange: window.range,
    periodMode: window.periodMode,
    dateFrom: window.dateFrom,
    dateTo: window.dateTo,
    club,
    actuals,
    targets,
    focus: focusFor(actuals, targets, reportNotes),
    rowCount: records.length,
    reportNotes
  };
}

function summariseNetRevenue(records) {
  const actuals = blankActuals();
  const rentNames = new Set();

  for (const record of records) {
    const amount = amountValue(record);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const text = recordText(record);
    if (isPtMmaPack(text)) {
      actuals.ptMmaPacksSold += 1;
      actuals.posRevenue = round2(actuals.posRevenue + amount);
    }
    if (isPaidPtSession(text)) actuals.paidPtSessions += 1;
    if (isSessionSplitIncome(text)) actuals.sessionSplitIncome = round2(actuals.sessionSplitIncome + amount);
    if (isPtRent(text)) {
      actuals.ptRentCollected = round2(actuals.ptRentCollected + amount);
      const name = field(record, ["Client", "Client Name", "Customer", "Member", "Full Name", "Name"]);
      if (name) rentNames.add(String(name).trim().toLowerCase());
    }
  }

  actuals.activePts = rentNames.size;
  return actuals;
}

async function optionalParticipationMetrics({ location, window }) {
  const attendanceFilter = process.env.HAPANA_FITNESS_ATTENDANCE_FILTER || "AttendanceBySession";
  const checkinFilter = process.env.HAPANA_FITNESS_CHECKIN_FILTER;
  if (!attendanceFilter && !checkinFilter) return {};

  const metrics = {};
  if (attendanceFilter) {
    const csv = await downloadCoreAdvancedReportCsv({
      locationName: location,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      filter: attendanceFilter,
      reportType: process.env.HAPANA_FITNESS_ATTENDANCE_REPORT_TYPE || "client",
      extraParams: paramsFromEnv("HAPANA_FITNESS_ATTENDANCE_PARAMS")
    });
    metrics.totalClassAttendance = sumAttendanceRows(parseDelimited(csv));
  }

  if (checkinFilter) {
    const csv = await downloadCoreAdvancedReportCsv({
      locationName: location,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      filter: checkinFilter,
      reportType: process.env.HAPANA_FITNESS_CHECKIN_REPORT_TYPE || "client",
      extraParams: paramsFromEnv("HAPANA_FITNESS_CHECKIN_PARAMS")
    });
    metrics.totalCheckins = sumCheckinRows(parseDelimited(csv));
  }

  return metrics;
}

async function optionalClassCostMetrics({ location, window }) {
  const costFilter = process.env.HAPANA_FITNESS_CLASS_COST_FILTER;
  if (!costFilter) return {};

  const csv = await downloadCoreAdvancedReportCsv({
    locationName: location,
    dateFrom: window.dateFrom,
    dateTo: window.dateTo,
    filter: costFilter,
    reportType: process.env.HAPANA_FITNESS_CLASS_COST_REPORT_TYPE || "client",
    extraParams: paramsFromEnv("HAPANA_FITNESS_CLASS_COST_PARAMS")
  });

  const rows = parseDelimited(csv);
  return rows.reduce((sum, row) => {
    const amount = amountValue(row);
    const text = recordText(row);
    if (/skill|mma|boxing|bjj|wrestling|muay|coach/i.test(text)) {
      sum.skillsClassCosts = round2(sum.skillsClassCosts + amount);
    } else {
      sum.conditioningClassCosts = round2(sum.conditioningClassCosts + amount);
    }
    return sum;
  }, { conditioningClassCosts: 0, skillsClassCosts: 0 });
}

function blankActuals() {
  return {
    totalCheckins: 0,
    totalClassAttendance: 0,
    totalClassCapacity: 0,
    classParticipationRatio: 0,
    ptMmaPacksSold: 0,
    paidPtSessions: 0,
    posRevenue: 0,
    sessionSplitIncome: 0,
    activePts: 0,
    ptRentCollected: 0,
    conditioningClassCosts: 0,
    skillsClassCosts: 0,
    paidClassCosts: 0,
    classCostBudget: 0
  };
}

function targetsForClub(club, targetOverrides = {}) {
  const configured = parseJsonEnv("HAPANA_FITNESS_TARGETS");
  return {
    ...blankActuals(),
    ...(DEFAULT_TARGETS[club] || {}),
    ...(configured[club] || {}),
    ...(targetOverrides[club] || {})
  };
}

function focusFor(actuals, targets, notes) {
  if (!actuals.totalCheckins && !actuals.totalClassAttendance) {
    return "Revenue metrics loaded from Hapana. Configure attendance/check-in report filters to populate participation.";
  }
  if (actuals.ptMmaPacksSold < targets.ptMmaPacksSold) return "PT/MMA pack sales are below target for the selected week.";
  if (actuals.paidClassCosts > targets.classCostBudget) return "Paid class costs are currently tracking above budget.";
  if (notes.length) return notes[0];
  return "Fitness KPIs are tracking within range for the selected week.";
}

function isPtMmaPack(text) {
  return /(pt|personal\s*training|mma|skills).*(pack|package)|(?:pack|package).*(pt|personal\s*training|mma|skills)/i.test(text)
    && !/rent|split/i.test(text);
}

function isPaidPtSession(text) {
  return /(paid\s*)?(pt|personal\s*training|skills)\s*session|session\s*(performed|complete|redeemed|delivered)/i.test(text)
    && !/split|rent/i.test(text);
}

function isSessionSplitIncome(text) {
  return /session[s]?[-\s]*split|split\s*income|trainer\s*split|coach\s*split/i.test(text);
}

function isPtRent(text) {
  return /(pt|trainer|coach).{0,20}rent|rent.{0,20}(pt|trainer|coach)/i.test(text);
}

function countRows(rows) {
  return rows.filter((row) => Object.values(row).some((value) => String(value || "").trim())).length;
}

function sumAttendanceRows(rows) {
  const total = rows.reduce((sum, row) =>
    sum + numberValue(field(row, ["Attendances", "Attendance", "Attended", "Total Attendances"])), 0);
  return total || countRows(rows);
}

function sumCheckinRows(rows) {
  const total = rows.reduce((sum, row) =>
    sum + numberValue(field(row, [
      "Total Attendance Count",
      "Total Sessions with Attendance",
      "Total Check-ins",
      "Total Checkins",
      "Check-ins",
      "Checkins",
      "Attendance Count",
      "Attendances",
      "Attendance"
    ])), 0);
  return total || countRows(rows);
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

async function fitnessWindow(params) {
  const explicitFrom = params.get("date_from");
  const explicitTo = params.get("date_to");
  const periodMode = params.get("period_mode") || (explicitFrom && explicitTo ? "custom" : "week");
  if (explicitFrom && explicitTo) return windowFromDates(explicitFrom, explicitTo, periodMode);

  const ddWindow = await loadDdWeekWindow();
  if (ddWindow) return windowFromDates(ddWindow.dateFrom, ddWindow.dateTo, "week");

  return fallbackWeekWindow();
}

async function loadDdWeekWindow() {
  const result = await get(WEEKLY_REVENUE_STORAGE_PATH, { access: "private", useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const payload = await new Response(result.stream).json().catch(() => null);
  if (!payload?.dateFrom || !payload?.dateTo) return null;
  return { dateFrom: payload.dateFrom, dateTo: payload.dateTo };
}

function fallbackWeekWindow() {
  const today = sydneyCalendarDate();
  const day = today.getUTCDay();
  const daysSinceThursday = (day - 4 + 7) % 7;
  const latestAvailableThursday = addDays(today, -daysSinceThursday);
  const end = addDays(latestAvailableThursday, -4);
  const start = addDays(end, -6);
  return windowFromDates(hapanaDate(start), hapanaDate(end), "week");
}

function windowFromDates(dateFrom, dateTo, periodMode = "week") {
  const end = parseHapanaDate(dateTo);
  const start = parseHapanaDate(dateFrom);
  const endIso = end.toISOString().slice(0, 10);
  const startIso = start.toISOString().slice(0, 10);
  return {
    dateFrom,
    dateTo,
    periodMode,
    period: periodId(periodMode, startIso, endIso),
    label: periodLabel(periodMode, start, end),
    range: `${displayDate(start)} to ${displayDate(end)}`
  };
}

function periodId(periodMode, startIso, endIso) {
  if (periodMode === "week") return endIso;
  if (periodMode === "month") return `month-${startIso}-${endIso}`;
  if (periodMode === "mtd") return `mtd-${startIso}-${endIso}`;
  return `custom-${startIso}-${endIso}`;
}

function samePeriodWindow(row, window) {
  if (row.period === window.period) return true;
  return row.periodMode === window.periodMode
    && row.dateFrom === window.dateFrom
    && row.dateTo === window.dateTo;
}

function periodLabel(periodMode, start, end) {
  if (periodMode === "month") {
    return new Intl.DateTimeFormat("en-AU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(start);
  }
  if (periodMode === "mtd") {
    return `${new Intl.DateTimeFormat("en-AU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(end)} MTD`;
  }
  if (periodMode === "week") return `Week ending ${displayDate(end)}`;
  return `Custom ${displayDate(start)} to ${displayDate(end)}`;
}

function sortRows(rows) {
  const order = new Map(LOCATIONS.map((location, index) => [location.club, index]));
  return [...rows].sort((a, b) =>
    String(b.period).localeCompare(String(a.period)) ||
    (order.get(a.club) ?? 99) - (order.get(b.club) ?? 99)
  );
}

function amountValue(record) {
  const value = field(record, ["Gross Revenue", "Gross", "Amount", "Total", "Cost", "Price"]);
  return round2(numberValue(value) / 1.1);
}

function numberValue(value) {
  if (!value) return 0;
  const negative = /\(.+\)|^-/.test(String(value));
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const amount = Number(cleaned || 0);
  return negative ? -amount : amount;
}

function recordText(record) {
  return [
    field(record, ["Description", "Package Name", "Product Name", "Item", "Class", "Service"]),
    field(record, ["Revenue Type", "RevenueType", "Category", "Transaction Category"]),
    field(record, ["Payment Status", "Status"])
  ].join(" ");
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

function paramsFromEnv(name) {
  const value = process.env[name];
  if (!value) return {};
  return Object.fromEntries(value.split("&").map((part) => {
    const [key, ...valueParts] = part.split("=");
    return [decodeURIComponent(key || ""), decodeURIComponent(valueParts.join("=") || "")];
  }).filter(([key]) => key));
}

function parseJsonEnv(name) {
  const value = process.env[name];
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
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

function parseHapanaDate(value) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function hapanaDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function displayDate(date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
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
