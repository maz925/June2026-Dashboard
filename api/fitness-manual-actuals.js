const { get, put } = require("@vercel/blob");

const VERSION = "fitness-manual-actuals-v1-2026-10-23";
const STORAGE_PATH = "fitness-manual-actuals.json";
const CLUBS = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];

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
    const existing = await loadStoredActuals();
    if (request.method === "GET") {
      response.status(200).json(existing);
      return;
    }

    assertWriteAccess(request);
    const body = await readJsonBody(request);
    const club = CLUBS.find((name) => name === body.club);
    const period = String(body.period || "").trim();
    const value = Number(body.coachInvoicesPaid);
    if (!club) throw new Error("Choose a valid club before saving coach invoices");
    if (!period) throw new Error("Choose a reporting period before saving coach invoices");
    if (!Number.isFinite(value) || value < 0) throw new Error("Coach invoices paid must be zero or greater");

    const key = `${period}::${club}`;
    const payload = {
      version: VERSION,
      updated: new Date().toISOString(),
      records: {
        ...(existing.records || {}),
        [key]: {
          period,
          periodLabel: String(body.periodLabel || period),
          periodRange: String(body.periodRange || ""),
          club,
          coachInvoicesPaid: round2(value),
          updated: new Date().toISOString()
        }
      }
    };

    await put(STORAGE_PATH, JSON.stringify(payload, null, 2), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json"
    });
    response.status(200).json({ ...payload, stored: true });
  } catch (error) {
    response.status(500).json({ error: errorText(error) });
  }
};

async function loadStoredActuals() {
  const result = await get(STORAGE_PATH, { access: "private", useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) {
    return { version: VERSION, updated: null, records: {} };
  }
  return new Response(result.stream).json();
}

function assertWriteAccess(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const auth = request.headers.authorization || request.headers.Authorization || "";
  if (auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret) return;
  throw new Error("Not authorised to update coach invoices");
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function errorText(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.message || String(error);
}
