const CORE_BASE_URL = "https://core.hapana.com";
const DEFAULT_LOGIN_URL = `${CORE_BASE_URL}/login`;
const ACCOUNT_LIST_URL = `${CORE_BASE_URL}/index.php?route=common/home/listAccounts`;
const REPORT_URL = `${CORE_BASE_URL}/index.php?route=dashboard/advreports`;

const KNOWN_LOCATIONS = [
  "UFC GYM Bankstown",
  "UFC GYM Wetherill Park",
  "UFC Gym Sandbox",
  "UFC GYM 580 George",
  "UFC GYM Woolooware"
];

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

  try {
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const locationName = url.searchParams.get("location") || "UFC GYM Bankstown";
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");

    if (!dateFrom || !dateTo) {
      throw new Error("date_from and date_to are required, using DD/MM/YYYY format");
    }

    if (!KNOWN_LOCATIONS.includes(locationName)) {
      throw new Error(`Unknown location. Use one of: ${KNOWN_LOCATIONS.join(", ")}`);
    }

    const email = process.env.HAPANA_CORE_EMAIL;
    const password = process.env.HAPANA_CORE_PASSWORD;
    if (!email || !password) {
      throw new Error("HAPANA_CORE_EMAIL and HAPANA_CORE_PASSWORD are not configured");
    }

    const jar = new CookieJar();
    await login(jar, email, password);
    await selectLocation(jar, locationName);
    const csv = await downloadReport(jar, { dateFrom, dateTo });

    const fileSafeLocation = locationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const fileSafeDateFrom = dateFrom.replace(/\//g, "-");
    const fileSafeDateTo = dateTo.replace(/\//g, "-");

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="net-revenue-detail-${fileSafeLocation}-${fileSafeDateFrom}-to-${fileSafeDateTo}.csv"`
    );
    response.status(200).send(csv);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};

async function login(jar, email, password) {
  const loginPage = await requestWithCookies(jar, process.env.HAPANA_CORE_LOGIN_URL || DEFAULT_LOGIN_URL);
  const loginHtml = await loginPage.text();

  const emailName = findInputName(loginHtml, ["email", "username", "user"]);
  const passwordName = findInputName(loginHtml, ["password", "pass"]);
  if (!emailName || !passwordName) {
    throw new Error(`Could not identify login fields. URL: ${DEFAULT_LOGIN_URL}. Page body: ${textSnippet(loginHtml)}`);
  }

  const form = new URLSearchParams(getHiddenInputs(loginHtml));
  form.set(emailName, email);
  form.set(passwordName, password);

  const rememberName = findInputName(loginHtml, ["remember"]);
  if (rememberName) form.set(rememberName, "1");

  const action = formAction(loginHtml) || DEFAULT_LOGIN_URL;
  const loginResponse = await requestWithCookies(jar, absoluteUrl(action, DEFAULT_LOGIN_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": DEFAULT_LOGIN_URL
    },
    body: form.toString()
  });

  const body = await loginResponse.text();
  const finalUrl = loginResponse.url || "";
  if (finalUrl.includes("/login") || finalUrl.includes("route=user/login") || /name=["']password["']/i.test(body)) {
    throw new Error(`Login did not succeed. URL: ${finalUrl || DEFAULT_LOGIN_URL}. Page body: ${textSnippet(body)}`);
  }
}

async function selectLocation(jar, locationName) {
  const accountPage = await requestWithCookies(jar, ACCOUNT_LIST_URL);
  const accountHtml = await accountPage.text();
  const locationUrl = extractLocationUrl(accountHtml, locationName);

  if (!locationUrl) {
    throw new Error(`Could not find account link for "${locationName}". URL: ${ACCOUNT_LIST_URL}. Page body: ${textSnippet(accountHtml)}`);
  }

  const selected = await requestWithCookies(jar, absoluteUrl(locationUrl, ACCOUNT_LIST_URL), {
    headers: { "Referer": ACCOUNT_LIST_URL }
  });
  const selectedHtml = await selected.text();

  if ((selected.url || "").includes("listAccounts") || /Hapana Accounts/i.test(selectedHtml)) {
    throw new Error(`Selecting "${locationName}" did not leave the account list. URL: ${selected.url}. Page body: ${textSnippet(selectedHtml)}`);
  }
}

async function downloadReport(jar, { dateFrom, dateTo }) {
  const reportUrl = new URL(REPORT_URL);
  reportUrl.searchParams.set("report_type", "client");
  reportUrl.searchParams.set("filter", "getNetRevenueDetail2");
  reportUrl.searchParams.set("removeCacheFlag", "1");
  reportUrl.searchParams.set("date_from", dateFrom);
  reportUrl.searchParams.set("date_to", dateTo);
  reportUrl.searchParams.set("downloadfile", "xls");

  const report = await requestWithCookies(jar, reportUrl.toString(), {
    headers: { "Referer": reportUrl.toString().replace("&downloadfile=xls", "") }
  });
  const body = await report.text();

  if (!report.ok) {
    throw new Error(`Report download failed with HTTP ${report.status}. Page body: ${textSnippet(body)}`);
  }

  if (!body.trim()) {
    throw new Error("Report download returned an empty file");
  }

  if (body.trimStart().startsWith("<")) {
    throw new Error(`Report download returned HTML instead of CSV. URL: ${report.url}. Page body: ${textSnippet(body)}`);
  }

  return body;
}

async function requestWithCookies(jar, url, options = {}) {
  const headers = {
    "Accept": "text/html,application/xhtml+xml,application/xml,text/csv,*/*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    ...(options.headers || {})
  };

  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: "manual"
  });

  jar.add(response.headers);

  if (isRedirect(response.status)) {
    const location = response.headers.get("location");
    if (!location) return response;
    return requestWithCookies(jar, absoluteUrl(location, url), {
      ...options,
      method: "GET",
      body: undefined,
      headers: {
        ...(options.headers || {}),
        Referer: url
      }
    });
  }

  return response;
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function findInputName(html, candidates) {
  const inputPattern = /<input\b[^>]*>/gi;
  const inputs = html.match(inputPattern) || [];

  for (const input of inputs) {
    const name = attr(input, "name");
    const id = attr(input, "id");
    const type = attr(input, "type");
    const haystack = `${name || ""} ${id || ""} ${type || ""}`.toLowerCase();
    if (candidates.some((candidate) => haystack.includes(candidate))) return name || id;
  }

  return "";
}

function getHiddenInputs(html) {
  const inputs = {};
  for (const input of html.match(/<input\b[^>]*>/gi) || []) {
    if ((attr(input, "type") || "").toLowerCase() !== "hidden") continue;
    const name = attr(input, "name");
    if (name) inputs[name] = attr(input, "value") || "";
  }
  return inputs;
}

function formAction(html) {
  const form = (html.match(/<form\b[^>]*>/i) || [])[0] || "";
  return attr(form, "action");
}

function extractLocationUrl(html, locationName) {
  const escapedName = escapeRegExp(locationName);
  const rowPattern = new RegExp(`<tr\\b[^>]*>[\\s\\S]*?${escapedName}[\\s\\S]*?<\\/tr>`, "i");
  const row = (html.match(rowPattern) || [])[0] || surroundingHtml(html, locationName);

  const href = attr(row, "href");
  if (href) return decodeHtml(href);

  const onclick = attr(row, "onclick");
  const onclickUrl = onclick && onclick.match(/(?:location(?:\.href)?|window\.location)\s*=\s*['"]([^'"]+)['"]/i);
  if (onclickUrl) return decodeHtml(onclickUrl[1]);

  const anyUrl = row.match(/(?:trainer_id|mytrainer_id|account_id|business_id)=[^"'&<\s]+/i);
  if (anyUrl) return `${CORE_BASE_URL}/index.php?${decodeHtml(anyUrl[0])}`;

  return "";
}

function surroundingHtml(html, text) {
  const index = html.toLowerCase().indexOf(text.toLowerCase());
  if (index < 0) return "";
  return html.slice(Math.max(0, index - 1000), index + 1000);
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[2] || match?.[3] || match?.[4] || "");
}

function absoluteUrl(url, base) {
  return new URL(decodeHtml(url), base).toString();
}

function textSnippet(html) {
  return decodeHtml(String(html).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 500);
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  add(headers) {
    const values = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);

    for (const value of values) {
      const first = value.split(";")[0];
      const separator = first.indexOf("=");
      if (separator <= 0) continue;
      this.cookies.set(first.slice(0, separator), first.slice(separator + 1));
    }
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}
