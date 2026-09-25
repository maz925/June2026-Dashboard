const MEMBER_CRON_VERSION = "member-cron-isolated-club-v5-2026-09-25";
const CLUBS = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ error: "Only GET is supported" });
    return;
  }

  try {
    assertCronAccess(request);

    const origin = `https://${request.headers.host}`;
    const auth = request.headers.authorization || request.headers.Authorization || "";
    const requestUrl = new URL(request.url, origin);
    const club = requestUrl.searchParams.get("club") || scheduledClub();
    if (!CLUBS.includes(club)) {
      response.status(400).json({ error: `Unknown club: ${club}` });
      return;
    }
    const url = new URL("/api/member-metrics", origin);
    url.searchParams.set("club", club);
    url.searchParams.set("source", "core");

    const result = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        ...(auth ? { "Authorization": auth } : {})
      }
    });

    const body = await result.json().catch(() => ({}));
    response.status(result.ok || result.status === 207 ? result.status : 207).json({
      version: MEMBER_CRON_VERSION,
      updated: new Date().toISOString(),
      status: result.status,
      club,
      ok: result.ok || result.status === 207,
      failures: body.failures || [],
      clubs: body.clubs || [],
      totals: body.totals || null,
      error: body.error || null
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};

function scheduledClub(now = new Date()) {
  const day = Math.floor(now.getTime() / 86400000);
  return CLUBS[day % CLUBS.length];
}

function assertCronAccess(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;

  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const auth = request.headers.authorization || request.headers.Authorization || "";
  const querySecret = url.searchParams.get("secret");

  if (auth === `Bearer ${secret}` || querySecret === secret) return;
  throw new Error("Not authorised to run member cron update");
}
