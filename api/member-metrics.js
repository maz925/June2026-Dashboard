const { get, put } = require("@vercel/blob");
const { downloadCoreReportCsv } = require("./core-report.js");

const MEMBER_METRICS_VERSION = "member-metrics-single-club-merge-v2-2026-06-05";
const STORAGE_PATH = "member-metrics.json";
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
    if (url.searchParams.get("stored") === "1") {
      const stored = await loadExistingMemberMetrics();
      response.status(200).json(stored || emptyPayload());
      return;
    }

    const window = monthWindow(url.searchParams);
    const debug = url.searchParams.get("debug");
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

    for (const { club, location } of targetLocations) {
      try {
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
        failures.push({ club, error: error.message });
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

    if (!rows.length) {
      throw new Error(`No member rows were calculated. Failures: ${JSON.stringify(failures)}`);
    }

    const existing = await loadExistingMemberMetrics();
    const existingClubs = existing?.dateFrom === window.dateFrom && existing?.dateTo === window.dateTo
      ? existing.clubs || []
      : [];
    const clubs = mergeClubRows(existingClubs, rows);

    const payload = {
      version: MEMBER_METRICS_VERSION,
      source: "Hapana Core Membership Detail",
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
  const days = dateRange(start, end);
  let active = 0;
  let cancellations = 0;
  let suspensions = 0;
  let newMemberships = 0;

  const dailyActive = days.map((date) => ({
    date: date.toISOString().slice(0, 10),
    active: 0
  }));

  for (const record of records) {
    const status = field(record, ["Status", "Membership Status", "Client Status", "Member Status", "Package Status"]);
    const startDate = bestDate(record, ["Start Date", "Membership Start Date", "Contract Start Date", "Sale Date", "Sold Date", "Purchase Date", "Created Date", "Join Date"]);
    const cancelDate = bestDate(record, ["Cancel Date", "Cancelled Date", "Cancellation Date", "Terminated Date", "End Date"]);
    const suspendDate = bestDate(record, ["Suspension Date", "Suspended Date", "Freeze Date", "Frozen Date", "Hold Date"]);

    if (isActiveStatus(status, cancelDate, end)) active += 1;
    if (inRange(cancelDate, start, end) || /cancel|terminat/i.test(status)) cancellations += 1;
    if (inRange(suspendDate, start, end) || /suspend|freeze|frozen|hold/i.test(status)) suspensions += 1;
    if (inRange(startDate, start, end)) newMemberships += 1;

    dailyActive.forEach((point) => {
      const pointDate = new Date(`${point.date}T00:00:00Z`);
      if (isActiveOnDate({ status, startDate, cancelDate }, pointDate)) point.active += 1;
    });
  }

  return {
    club,
    activeMembers: active,
    cancellations,
    suspensions,
    newMemberships,
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
    cancellations: rows.reduce((sum, row) => sum + (row.cancellations || 0), 0),
    suspensions: rows.reduce((sum, row) => sum + (row.suspensions || 0), 0),
    newMemberships: rows.reduce((sum, row) => sum + (row.newMemberships || 0), 0),
    dailyActive: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, active]) => ({ date, active }))
  };
}

function isActiveStatus(status, cancelDate, end) {
  const text = String(status || "").toLowerCase();
  if (/cancel|terminat|inactive|expired|depleted|deleted/.test(text)) return false;
  if (cancelDate && cancelDate <= end) return false;
  return !text || /active|current|ok|open/.test(text) || !/suspend|freeze|hold/.test(text);
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
