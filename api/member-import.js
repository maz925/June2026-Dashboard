const { get, put } = require("@vercel/blob");

const STORAGE_PATH = "member-metrics.json";
const MEMBER_IMPORT_VERSION = "member-import-csv-active-v1-2026-06-08";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const LOCATIONS = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Only POST is supported" });
    return;
  }

  try {
    assertCronAccess(request);

    const contentType = request.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      throw new Error("Upload must use multipart/form-data");
    }

    const body = await readBody(request);
    const parts = parseMultipart(body, contentType);
    const club = String(parts.club?.text || "").trim();
    const dateFrom = String(parts.date_from?.text || "").trim();
    const dateTo = String(parts.date_to?.text || "").trim();
    const file = parts.file;

    if (!LOCATIONS.includes(club)) throw new Error(`Choose one of: ${LOCATIONS.join(", ")}`);
    if (!dateFrom || !dateTo) throw new Error("date_from and date_to are required");
    if (!file?.buffer?.length) throw new Error("CSV file is required");

    const csv = file.buffer.toString("utf8").replace(/^\uFEFF/, "");
    const records = parseDelimited(csv);
    if (!records.length) throw new Error("No rows were found in the uploaded file");

    const row = summariseRecords(records, { club, dateFrom, dateTo });
    const existing = await loadExistingMemberMetrics();
    const existingClubs = existing?.dateFrom === dateFrom && existing?.dateTo === dateTo
      ? existing.clubs || []
      : [];
    const clubs = mergeClubRows(existingClubs, [row]);

    const payload = {
      version: MEMBER_IMPORT_VERSION,
      source: "Uploaded Membership Detail CSV",
      updated: new Date().toISOString(),
      dateFrom,
      dateTo,
      monthKey: parseHapanaDate(dateTo).toISOString().slice(0, 7),
      clubs,
      totals: totalRows(clubs),
      failures: []
    };

    const blob = await put(STORAGE_PATH, JSON.stringify(payload, null, 2), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json"
    });

    response.status(200).json({
      ...payload,
      imported: row,
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
  throw new Error("Not authorised to import member metrics");
}

async function readBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES) throw new Error("Upload is too large. Save one club report as CSV and try again.");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function parseMultipart(body, contentType) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1]
    || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) throw new Error("Multipart boundary was not found");

  const marker = Buffer.from(`--${boundary}`);
  const parts = {};
  let start = body.indexOf(marker);

  while (start >= 0) {
    start += marker.length;
    if (body[start] === 45 && body[start + 1] === 45) break;
    if (body[start] === 13 && body[start + 1] === 10) start += 2;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), start);
    if (headerEnd < 0) break;

    const headerText = body.slice(start, headerEnd).toString("utf8");
    const dataStart = headerEnd + 4;
    let next = body.indexOf(marker, dataStart);
    if (next < 0) next = body.length;
    let dataEnd = next;
    if (body[dataEnd - 2] === 13 && body[dataEnd - 1] === 10) dataEnd -= 2;

    const name = headerText.match(/name="([^"]+)"/i)?.[1];
    const filename = headerText.match(/filename="([^"]*)"/i)?.[1] || "";
    if (name) {
      const buffer = body.slice(dataStart, dataEnd);
      parts[name] = filename
        ? { filename, buffer }
        : { text: buffer.toString("utf8") };
    }

    start = next;
  }

  return parts;
}

async function loadExistingMemberMetrics() {
  const result = await get(STORAGE_PATH, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return new Response(result.stream).json();
}

function mergeClubRows(existingRows, newRows) {
  const rowsByClub = new Map();
  for (const row of existingRows) {
    if (row?.club) rowsByClub.set(row.club, row);
  }
  for (const row of newRows) {
    if (row?.club) rowsByClub.set(row.club, row);
  }
  return LOCATIONS.map((club) => rowsByClub.get(club)).filter(Boolean);
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
    const status = field(record, ["Package Status", "Membership Status", "Status", "Client Status", "Member Status"]);
    const startDate = bestDate(record, ["Start Date", "Membership Start Date", "Contract Start Date", "Sale Date", "Sold Date", "Purchase Date", "Created Date", "Join Date", "Date Sold", "Member Created Date"]);
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
    rowCount: records.length,
    importSource: "csv"
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

function isActiveStatus(status, cancelDate, end) {
  const text = String(status || "").toLowerCase();
  if (cancelDate && cancelDate <= end) return false;
  return text === "active";
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

function parseLooseDate(value) {
  const text = String(value || "").trim();
  if (!text || /^unending$/i.test(text)) return null;

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

function parseHapanaDate(value) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateRange(start, end) {
  const dates = [];
  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    dates.push(new Date(date));
  }
  return dates;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function inRange(date, start, end) {
  return Boolean(date && date >= start && date <= end);
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
