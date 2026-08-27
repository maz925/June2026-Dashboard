module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ error: "Only GET is supported" });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  response.status(200).json({
    enabled: Boolean(clientId),
    provider: "google",
    clientId,
    allowedDomain: process.env.GOOGLE_ALLOWED_DOMAIN || "",
    origin: requestOrigin(request)
  });
};

function requestOrigin(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host || "";
  if (!host) return "";
  const proto = request.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  return `${String(proto).split(",")[0]}://${String(host).split(",")[0]}`;
}
