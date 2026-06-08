const MEMBER_CRON_VERSION = "member-cron-active-first-v2-2026-06-05";

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
    const results = await Promise.all(CLUBS.map(async (club) => {
      const url = new URL("/api/member-metrics", origin);
      url.searchParams.set("club", club);
      url.searchParams.set("deep", "1");

      const result = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          ...(auth ? { "Authorization": auth } : {})
        }
      });

      const body = await result.json().catch(() => ({}));
      return {
        club,
        status: result.status,
        ok: result.ok || result.status === 207,
        error: body.error || null,
        failures: body.failures || []
      };
    }));

    const failed = results.filter((item) => !item.ok);
    response.status(failed.length ? 207 : 200).json({
      version: MEMBER_CRON_VERSION,
      updated: new Date().toISOString(),
      results
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
  throw new Error("Not authorised to run member cron update");
}
