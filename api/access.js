const crypto = require("crypto");

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
let certCache = { expires: 0, keys: [] };

function bearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cronAuthorised(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const token = bearerToken(request);
  return token === secret || url.searchParams.get("secret") === secret;
}

async function authoriseRead(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Authorization");
  if (cronAuthorised(request)) return true;
  if (!process.env.GOOGLE_CLIENT_ID) return true;
  try {
    await verifyGoogleCredential(bearerToken(request));
    return true;
  } catch (error) {
    response.status(error.statusCode || 401).json({ error: "Sign in required" });
    return false;
  }
}

async function authoriseMutation(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  // Preserve the existing pipeline: with no CRON_SECRET, scheduled jobs are indistinguishable
  // from other callers, so mutations stay open. With a secret, cron or a signed-in user may write.
  if (!process.env.CRON_SECRET) return true;
  if (cronAuthorised(request)) return true;
  if (process.env.GOOGLE_CLIENT_ID) {
    try {
      await verifyGoogleCredential(bearerToken(request));
      return true;
    } catch (error) {
      response.status(401).json({ error: "Sign in required" });
      return false;
    }
  }
  response.status(401).json({ error: "Not authorised" });
  return false;
}

async function verifyGoogleCredential(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const error = new Error("GOOGLE_CLIENT_ID is not configured");
    error.statusCode = 503;
    throw error;
  }
  if (!credential || typeof credential !== "string" || credential.split(".").length !== 3) {
    const error = new Error("Google sign-in is required");
    error.statusCode = 401;
    throw error;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = credential.split(".");
  const header = decodeJwtJson(encodedHeader);
  const payload = decodeJwtJson(encodedPayload);
  const now = Math.floor(Date.now() / 1000);

  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throwAuthError("Invalid Google token issuer");
  }
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) throwAuthError("Invalid Google token audience");
  if (!payload.exp || payload.exp < now) throwAuthError("Google sign-in has expired");
  if (payload.iat && payload.iat > now + 300) throwAuthError("Google sign-in token is not valid yet");
  if (!payload.email_verified) throwAuthError("Google account email is not verified");

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
  if (!verifier.verify(key, decodeBase64Url(encodedSignature))) throwAuthError("Google token signature is invalid");
  return payload;
}

async function googleKeys() {
  if (certCache.keys.length && certCache.expires > Date.now()) return certCache.keys;
  const certResponse = await fetch(GOOGLE_CERTS_URL);
  if (!certResponse.ok) throw new Error(`Google certificates returned ${certResponse.status}`);
  const body = await certResponse.json();
  const maxAge = /max-age=(\d+)/i.exec(certResponse.headers.get("cache-control") || "");
  certCache = {
    keys: body.keys || [],
    expires: Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : 3600000)
  };
  return certCache.keys;
}

function decodeJwtJson(value) {
  return JSON.parse(decodeBase64Url(value).toString("utf8"));
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function throwAuthError(message) {
  const error = new Error(message);
  error.statusCode = 401;
  throw error;
}

module.exports = {
  authoriseRead,
  authoriseMutation,
  verifyGoogleCredential
};
