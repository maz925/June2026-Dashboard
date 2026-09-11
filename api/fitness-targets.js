const { get, put } = require("@vercel/blob");

const FITNESS_TARGETS_VERSION = "fitness-targets-v1-2026-09-10";
const STORAGE_PATH = "fitness-targets.json";

const TARGET_KEYS = [
  "totalCheckins",
  "totalClassAttendance",
  "classParticipationRatio",
  "ptMmaPacksSold",
  "paidPtSessions",
  "posRevenue",
  "sessionSplitIncome",
  "activePts",
  "ptRentCollected",
  "conditioningClassCosts",
  "skillsClassCosts",
  "paidClassCosts",
  "classCostBudget"
];

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
    if (request.method === "GET") {
      response.status(200).json(await loadStoredTargets());
      return;
    }

    assertWriteAccess(request);

    const body = await readJsonBody(request);
    const club = CLUBS.find((name) => name === body.club);
    if (!club) throw new Error("Choose a valid club before saving targets");

    const existing = await loadStoredTargets();
    const payload = {
      version: FITNESS_TARGETS_VERSION,
      updated: new Date().toISOString(),
      clubs: CLUBS,
      targets: {
        ...(existing.targets || {}),
        [club]: sanitiseTargets(body.targets || {})
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

async function loadStoredTargets() {
  const result = await get(STORAGE_PATH, { access: "private", useCache: false }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) {
    return {
      version: FITNESS_TARGETS_VERSION,
      updated: null,
      clubs: CLUBS,
      targets: {}
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
  throw new Error("Not authorised to update Fitness KPI targets");
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sanitiseTargets(input) {
  return Object.fromEntries(TARGET_KEYS.map((key) => {
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
