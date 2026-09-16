const crypto = require("crypto");
const { get, put } = require("@vercel/blob");

const STORAGE_PATH = "view-log.json";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const MAX_LOGS = 2000;

let certCache = { expires: 0, keys: [] };

module.exports = async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Google-Credential");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    if (request.method === "GET") {
      await assertViewLogAccess(request);
      const logs = await readLogs();
      response.status(200).json({ logs: logs.slice(-500).reverse() });
      return;
    }

    if (request.method === "POST") {
      const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
      const profile = await verifyGoogleCredential(body.credential);
      const entry = {
        timestamp: new Date().toISOString(),
        email: profile.email || "",
        name: profile.name || "",
        picture: profile.picture || "",
        page: cleanText(body.page, 80),
        view: cleanText(body.view, 80),
        club: cleanText(body.club, 80),
        ip: clientIp(request),
        userAgent: cleanText(request.headers["user-agent"], 240)
      };
      const logs = await readLogs();
      logs.push(entry);
      await writeLogs(logs.slice(-MAX_LOGS));
      response.status(200).json({ ok: true });
      return;
    }

    response.status(405).json({ error: "Only GET, POST and OPTIONS are supported" });
  } catch (error) {
    response.status(error.statusCode || 500).json({ error: error.message || "View log request failed" });
  }
};

async function assertViewLogAccess(request) {
  const secret = process.env.VIEW_LOG_SECRET || "";

  const requestUrl = new URL(request.url, "https://dashboard.local");
  const token = requestUrl.searchParams.get("secret") ||
    String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (secret && token === secret) return;

  const googleCredential = request.headers["x-google-credential"];
  if (googleCredential) {
    await verifyGoogleCredential(String(googleCredential));
    return;
  }

  const error = new Error("View log access denied");
  error.statusCode = 401;
  throw error;
}

async function verifyGoogleCredential(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const error = new Error("GOOGLE_CLIENT_ID is not configured");
    error.statusCode = 503;
    throw error;
  }
  if (!credential || typeof credential !== "string") {
    const error = new Error("Google sign-in credential is required");
    error.statusCode = 401;
    throw error;
  }

  const parts = credential.split(".");
  if (parts.length !== 3) {
    const error = new Error("Invalid Google sign-in credential");
    error.statusCode = 401;
    throw error;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtJson(encodedHeader);
  const payload = decodeJwtJson(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  const issuer = payload.iss;

  if (issuer !== "https://accounts.google.com" && issuer !== "accounts.google.com") {
    throwAuthError("Invalid Google token issuer");
  }
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    throwAuthError("Invalid Google token audience");
  }
  if (!payload.exp || payload.exp < now) {
    throwAuthError("Google sign-in has expired");
  }
  if (payload.iat && payload.iat > now + 300) {
    throwAuthError("Google sign-in token is not valid yet");
  }
  if (!payload.email_verified) {
    throwAuthError("Google account email is not verified");
  }

  const allowedDomain = (process.env.GOOGLE_ALLOWED_DOMAIN || "").trim().toLowerCase();
  if (allowedDomain) {
    const email = String(payload.email || "").toLowerCase();
    const hostedDomain = String(payload.hd || "").toLowerCase();
    if (hostedDomain !== allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
      throwAuthError(`Sign in with a ${allowedDomain} account`);
    }
  }

  const keys = await googleKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throwAuthError("Google signing key was not found");

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const valid = verifier.verify(key, decodeBase64Url(encodedSignature));
  if (!valid) throwAuthError("Google token signature is invalid");

  return payload;
}

async function googleKeys() {
  if (certCache.keys.length && certCache.expires > Date.now()) return certCache.keys;
  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) throw new Error(`Google certificates returned ${response.status}`);
  const body = await response.json();
  const maxAge = /max-age=(\d+)/i.exec(response.headers.get("cache-control") || "");
  certCache = {
    keys: body.keys || [],
    expires: Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : 3600000)
  };
  return certCache.keys;
}

async function readLogs() {
  try {
    const file = await get(STORAGE_PATH, { access: "private", useCache: false });
    if (!file?.stream) return [];
    const body = JSON.parse(await streamToText(file.stream));
    return Array.isArray(body.logs) ? body.logs : [];
  } catch (error) {
    if (error?.message?.includes("not found") || error?.status === 404) return [];
    throw error;
  }
}

async function writeLogs(logs) {
  await put(STORAGE_PATH, JSON.stringify({ logs }, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json"
  });
}

function decodeJwtJson(value) {
  return JSON.parse(decodeBase64Url(value).toString("utf8"));
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

async function streamToText(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function cleanText(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || request.socket?.remoteAddress || "";
}

function throwAuthError(message) {
  const error = new Error(message);
  error.statusCode = 401;
  throw error;
}
