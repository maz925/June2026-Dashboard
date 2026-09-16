const CORE_BASE_URL = "https://core.hapana.com";
const CORE_REPORT_VERSION = "core-report-report-timeout-v2-2026-06-05";
const DEFAULT_LOGIN_URL = `${CORE_BASE_URL}/login`;
const ACCOUNT_LIST_URL = `${CORE_BASE_URL}/index.php?route=common/home/listAccounts`;
const REPORT_URL = `${CORE_BASE_URL}/index.php?route=dashboard/advreports`;

const KNOWN_LOCATIONS = [
  "UFC GYM Bankstown",
  "UFC GYM Wetherill Park",
  "UFC Gym Sandbox",
  "UFC GYM 580 George",
  "UFC GYM Woolooware",
  "580 George",
  "George St",
  "George Street",
  "580G"
];

const LOCATION_CUSTOMER_IDS = {
  "UFC GYM Bankstown": "74191",
  "UFC GYM Wetherill Park": "91411",
  "UFC Gym Sandbox": "67012",
  "UFC GYM 580 George": "159336",
  "UFC GYM Woolooware": "159340",
  "580 George": "159336",
  "George St": "159336",
  "George Street": "159336",
  "580G": "159336"
};

const REPORTS = {
  netRevenueDetail: {
    filter: "getNetRevenueDetail2",
    reportType: "client",
    filePrefix: "net-revenue-detail"
  },
  membershipDetail: {
    filter: "getMembershipDetails",
    reportType: "client",
    filePrefix: "membership-detail"
  }
};

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
    const debug = url.searchParams.get("debug");

    if (!dateFrom || !dateTo) {
      throw new Error("date_from and date_to are required, using DD/MM/YYYY format");
    }

    if (!KNOWN_LOCATIONS.includes(locationName)) {
      throw new Error(`Unknown location. Use one of: ${KNOWN_LOCATIONS.join(", ")}`);
    }

    const jar = await createCoreSession();

    if (debug === "account") {
      const accountPage = await requestWithCookies(jar, ACCOUNT_LIST_URL);
      const accountHtml = await accountPage.text();
      const row = locationRowHtml(accountHtml, locationName);
      response.status(200).json({
        version: CORE_REPORT_VERSION,
        location: locationName,
        extractedUrl: extractLocationUrl(accountHtml, locationName),
        rowHtml: row.slice(0, 4000),
        rowText: textSnippet(row)
      });
      return;
    }

    if (debug === "reports") {
      await selectLocation(jar, locationName);
      const reportsUrl = new URL(REPORT_URL);
      reportsUrl.searchParams.set("report_type", "client");
      if (url.searchParams.get("filter")) reportsUrl.searchParams.set("filter", url.searchParams.get("filter"));
      const reportsPage = await requestWithCookies(jar, reportsUrl.toString(), {
        headers: { "Referer": reportsUrl.toString() }
      });
      const reportsHtml = await reportsPage.text();
      const filters = [...new Set([...reportsHtml.matchAll(/get[A-Za-z0-9_]+/g)].map((match) => match[0]))].sort();
      response.status(200).json({
        version: CORE_REPORT_VERSION,
        location: locationName,
        filters,
        fields: extractRelevantReportFields(reportsHtml),
        text: textSnippet(reportsHtml)
      });
      return;
    }

    const customFilter = url.searchParams.get("filter");
    const reportType = url.searchParams.get("report_type") || "client";
    const reportKey = customFilter ? "" : (url.searchParams.get("report") || "netRevenueDetail");
    const reportConfig = reportKey ? REPORTS[reportKey] : {
      filter: customFilter,
      reportType,
      filePrefix: customFilter || "advanced-report"
    };
    if (!reportConfig?.filter) {
      throw new Error(`Unknown report. Use one of: ${Object.keys(REPORTS).join(", ")}`);
    }

    const csv = customFilter
      ? await downloadCoreAdvancedReportCsv({
        locationName,
        dateFrom,
        dateTo,
        filter: customFilter,
        reportType,
        jar,
        extraParams: reportParamsFromSearch(url.searchParams)
      })
      : await downloadCoreReportCsv({
        locationName,
        dateFrom,
        dateTo,
        reportKey,
        jar,
        extraParams: reportParamsFromSearch(url.searchParams)
      });

    const fileSafeLocation = locationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const fileSafeDateFrom = dateFrom.replace(/\//g, "-");
    const fileSafeDateTo = dateTo.replace(/\//g, "-");

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportConfig.filePrefix}-${fileSafeLocation}-${fileSafeDateFrom}-to-${fileSafeDateTo}.csv"`
    );
    response.status(200).send(csv);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};

module.exports.downloadCoreReportCsv = downloadCoreReportCsv;
module.exports.downloadCoreAdvancedReportCsv = downloadCoreAdvancedReportCsv;
module.exports.createCoreSession = createCoreSession;
module.exports.requestWithCookies = requestWithCookies;
module.exports.ACCOUNT_LIST_URL = ACCOUNT_LIST_URL;
module.exports.CORE_REPORT_LOCATIONS = LOCATION_CUSTOMER_IDS;
module.exports.CORE_REPORTS = REPORTS;

async function createCoreSession() {
  const email = process.env.HAPANA_CORE_EMAIL;
  const password = process.env.HAPANA_CORE_PASSWORD;
  if (!email || !password) {
    throw new Error("HAPANA_CORE_EMAIL and HAPANA_CORE_PASSWORD are not configured");
  }

  const jar = new CookieJar();
  await login(jar, email, password);
  return jar;
}

async function downloadCoreReportCsv({ locationName, dateFrom, dateTo, reportKey = "netRevenueDetail", jar, extraParams }) {
  if (!KNOWN_LOCATIONS.includes(locationName)) {
    throw new Error(`Unknown location. Use one of: ${KNOWN_LOCATIONS.join(", ")}`);
  }

  const session = jar || await createCoreSession();
  await selectLocation(session, locationName);
  return downloadReport(session, { dateFrom, dateTo, reportKey, extraParams });
}

async function downloadCoreAdvancedReportCsv({ locationName, dateFrom, dateTo, filter, reportType = "client", jar, extraParams }) {
  if (!filter) throw new Error("Report filter is required");
  if (!KNOWN_LOCATIONS.includes(locationName)) {
    throw new Error(`Unknown location. Use one of: ${KNOWN_LOCATIONS.join(", ")}`);
  }

  const session = jar || await createCoreSession();
  await selectLocation(session, locationName);
  return downloadReport(session, { dateFrom, dateTo, filter, reportType, extraParams });
}

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
  const locationUrl = locationSwitchUrl(locationName) || extractLocationUrl(accountHtml, locationName);

  if (!locationUrl) {
    throw new Error(`Could not find account link for "${locationName}". URL: ${ACCOUNT_LIST_URL}. Row HTML: ${locationRowHtml(accountHtml, locationName).slice(0, 1000)}. Page body: ${textSnippet(accountHtml)}`);
  }

  const selected = await requestWithCookies(jar, absoluteUrl(locationUrl, ACCOUNT_LIST_URL), {
    headers: { "Referer": ACCOUNT_LIST_URL }
  });
  const selectedHtml = await selected.text();

  if ((selected.url || "").includes("listAccounts") || /Hapana Accounts/i.test(selectedHtml)) {
    throw new Error(`Selecting "${locationName}" did not leave the account list. Target: ${locationUrl}. URL: ${selected.url}. Row HTML: ${locationRowHtml(accountHtml, locationName).slice(0, 1000)}. Page body: ${textSnippet(selectedHtml)}`);
  }
}

function locationSwitchUrl(locationName) {
  const customerId = LOCATION_CUSTOMER_IDS[locationName];
  return customerId
    ? `${CORE_BASE_URL}/index.php?route=dashboard/trainer/updateTrainerAccount&customer_id=${customerId}`
    : "";
}

async function downloadReport(jar, { dateFrom, dateTo, reportKey = "netRevenueDetail", filter, reportType, extraParams }) {
  const reportConfig = reportKey ? REPORTS[reportKey] : null;
  const resolvedFilter = filter || reportConfig?.filter;
  const resolvedReportType = reportType || reportConfig?.reportType || "client";
  if (!resolvedFilter) throw new Error(`Unknown report key: ${reportKey}`);

  const reportUrl = new URL(REPORT_URL);
  reportUrl.searchParams.set("report_type", resolvedReportType);
  reportUrl.searchParams.set("filter", resolvedFilter);
  reportUrl.searchParams.set("removeCacheFlag", "1");
  reportUrl.searchParams.set("date_from", dateFrom);
  reportUrl.searchParams.set("date_to", dateTo);
  reportUrl.searchParams.set("downloadfile", "xls");
  for (const [key, value] of Object.entries(extraParams || {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== undefined && item !== null && item !== "") reportUrl.searchParams.append(key, item);
    }
  }

  const report = await requestWithCookies(jar, reportUrl.toString(), {
    headers: { "Referer": reportUrl.toString().replace("&downloadfile=xls", "") },
    timeoutMs: Number(process.env.HAPANA_CORE_REPORT_TIMEOUT_MS || 240000)
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

  const timeoutMs = options.timeoutMs || 0;
  const controller = timeoutMs ? new AbortController() : null;
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
      redirect: "manual",
      signal: controller?.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Core Hapana request timed out after ${Math.round(timeoutMs / 1000)}s: ${url}`);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }

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

function reportParamsFromSearch(params) {
  const reserved = new Set(["location", "date_from", "date_to", "debug", "report", "filter", "report_type"]);
  const output = {};
  for (const [key, value] of params.entries()) {
    if (reserved.has(key)) continue;
    if (output[key]) {
      output[key] = Array.isArray(output[key]) ? [...output[key], value] : [output[key], value];
    } else {
      output[key] = value;
    }
  }
  return output;
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
  const row = locationRowHtml(html, locationName);

  const candidates = [];

  const onclick = attr(row, "onclick");
  const onclickUrl = onclick && onclick.match(/(?:location(?:\.href)?|window\.location)\s*=\s*['"]([^'"]+)['"]/i);
  if (onclickUrl) candidates.push(onclickUrl[1]);

  for (const match of row.matchAll(/\bonclick\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const value = decodeHtml(match[2] || match[3] || match[4] || "");
    const sessionMatch = value.match(/updateSessionID\((\d+)\)/i);
    if (sessionMatch) {
      candidates.push(`${CORE_BASE_URL}/index.php?route=dashboard/trainer/updateTrainerAccount&customer_id=${sessionMatch[1]}`);
    }

    const urlMatch = value.match(/(?:location(?:\.href)?|window\.location)\s*=\s*['"]([^'"]+)['"]/i)
      || value.match(/['"]([^'"]*(?:trainer_id|mytrainer_id|account_id|business_id|select|switch|loginaccount|setaccount)[^'"]*)['"]/i);
    if (urlMatch) candidates.push(urlMatch[1]);
  }

  for (const match of row.matchAll(/\b(?:data-href|href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    candidates.push(match[2] || match[3] || match[4] || "");
  }

  const anyUrl = row.match(/(?:trainer_id|mytrainer_id|account_id|business_id)=[^"'&<\s]+/i);
  if (anyUrl) candidates.push(`${CORE_BASE_URL}/index.php?${decodeHtml(anyUrl[0])}`);

  for (const candidate of candidates.map(decodeHtml)) {
    if (isAccountSelectionUrl(candidate)) return candidate;
  }

  return "";
}

function locationRowHtml(html, locationName) {
  const escapedName = escapeRegExp(locationName);
  const tableStart = Math.max(
    html.toLowerCase().indexOf("business name"),
    html.toLowerCase().indexOf("hapana accounts")
  );
  const searchHtml = tableStart >= 0 ? html.slice(tableStart) : html;
  const match = new RegExp(escapedName, "i").exec(searchHtml);

  if (match) {
    const absoluteIndex = (tableStart >= 0 ? tableStart : 0) + match.index;
    const rowStart = html.lastIndexOf("<tr", absoluteIndex);
    const rowEnd = html.indexOf("</tr>", absoluteIndex);
    if (rowStart >= 0 && rowEnd >= 0) return html.slice(rowStart, rowEnd + 5);

    const listItemStart = html.lastIndexOf("<li", absoluteIndex);
    const listItemEnd = html.indexOf("</li>", absoluteIndex);
    if (listItemStart >= 0 && listItemEnd >= 0) {
      return html.slice(listItemStart, listItemEnd + 5);
    }

    return html.slice(Math.max(0, absoluteIndex - 4000), absoluteIndex + 4000);
  }

  const rowPattern = new RegExp(`<tr\\b[^>]*>[\\s\\S]*?${escapedName}[\\s\\S]*?<\\/tr>`, "i");
  return (html.match(rowPattern) || [])[0] || surroundingHtml(html, locationName);
}

function isAccountSelectionUrl(value) {
  const url = String(value || "").trim();
  if (!url || url === "#" || /^javascript:/i.test(url)) return false;

  let parsed;
  try {
    parsed = new URL(url, ACCOUNT_LIST_URL);
  } catch (error) {
    return false;
  }

  if (parsed.href === ACCOUNT_LIST_URL || parsed.hash) return false;

  const text = parsed.href.toLowerCase();
  return text.includes("trainer_id=")
    || text.includes("mytrainer_id=")
    || text.includes("account_id=")
    || text.includes("business_id=")
    || text.includes("customer_id=")
    || text.includes("select")
    || text.includes("switch")
    || text.includes("loginaccount")
    || text.includes("setaccount")
    || text.includes("updatetraineraccount");
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

function extractRelevantReportFields(html) {
  const fields = [];
  const relevant = /(status|suspend|active|cancel|package|membership|member|client|filter)/i;

  for (const input of String(html || "").match(/<input\b[^>]*>/gi) || []) {
    const field = {
      tag: "input",
      type: attr(input, "type"),
      name: attr(input, "name"),
      id: attr(input, "id"),
      value: attr(input, "value")
    };
    if (relevant.test(Object.values(field).join(" "))) fields.push(field);
  }

  for (const selectMatch of String(html || "").matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const open = selectMatch[1] || "";
    const body = selectMatch[2] || "";
    const options = [...body.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)]
      .map((match) => ({
        value: attr(match[1], "value"),
        text: textSnippet(match[2]).slice(0, 120)
      }))
      .filter((option) => relevant.test(`${option.value} ${option.text}`))
      .slice(0, 30);
    const field = {
      tag: "select",
      name: attr(open, "name"),
      id: attr(open, "id"),
      options
    };
    if (relevant.test(`${field.name} ${field.id}`) || options.length) fields.push(field);
  }

  return fields.slice(0, 80);
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
