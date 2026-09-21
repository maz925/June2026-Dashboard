const { get, put } = require("@vercel/blob");

const FITNESS_SLA_VERSION = "fitness-sla-v1-2026-09-16";
const STORAGE_PATH = "fitness-sla.json";
const CLUBS = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];

const SLA_KEYS = [
  "activeCandidates",
  "applicantsContacted48Pct",
  "interviews7DaysPct",
  "onboarding14DaysPct",
  "vacancyFillDays",
  "coachObservations",
  "ptSessionAudits",
  "groupFitnessAudits",
  "writtenFeedback48Pct",
  "monthlyCoachWorkshops",
  "programmingCompliancePct",
  "weeklyReportOnTimePct",
  "monthlyReportOnTimePct"
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
    if (request.method === "GET") {
      response.status(200).json(await loadStoredSla());
      return;
    }

    assertWriteAccess(request);

    const body = await readJsonBody(request);
    const club = CLUBS.find((name) => name === body.club);
    const period = String(body.period || "").trim();
    if (!club) throw new Error("Choose a valid club before saving SLA tracking");
    if (!period) throw new Error("Choose a valid period before saving SLA tracking");

    const existing = await loadStoredSla();
    const key = `${period}::${club}`;
    const payload = {
      version: FITNESS_SLA_VERSION,
      updated: new Date().toISOString(),
      clubs: CLUBS,
      records: {
        ...(existing.records || {}),
        [key]: {
          period,
          periodLabel: String(body.periodLabel || period),
          periodRange: String(body.periodRange || ""),
          club,
          actuals: sanitiseActuals(body.actuals || {})
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

async function loadStoredSla() {
  const result = await get(STORAGE_PATH, { access: "private", useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) {
    return {
      version: FITNESS_SLA_VERSION,
      updated: null,
      clubs: CLUBS,
      records: {}
    };
  }
  return new Response(result.stream).json();
}

function assertWriteAccess(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;

  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const auth = request.headers.authorization || request.headers.Authorization || "";
  const querySecret = url.searchParams.get("secret");

  if (auth === `Bearer ${secret}` || querySecret === secret) return;
  throw new Error("Not authorised to update Fitness SLA tracking");
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sanitiseActuals(input) {
  return Object.fromEntries(SLA_KEYS.map((key) => {
    const value = Number(input[key]);
    return [key, Number.isFinite(value) && value >= 0 ? value : 0];
  }));
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
