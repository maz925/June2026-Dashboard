const chromium = require("@sparticuz/chromium");
const { chromium: playwrightChromium } = require("playwright-core");

const CORE_BASE_URL = "https://core.hapana.com";
const DEFAULT_LOGIN_URL = `${CORE_BASE_URL}/login`;
const ACCOUNT_LIST_URL = `${CORE_BASE_URL}/index.php?route=common/home/listAccounts`;
const REPORT_PATH = "/index.php?route=dashboard/advreports";

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

  let browser;

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

    browser = await launchBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, email, password);
    await selectLocation(page, locationName);

    const csv = await fetchReportCsv(context, { dateFrom, dateTo });
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
  } finally {
    if (browser) await browser.close();
  }
};

async function launchBrowser() {
  const executablePath = await chromium.executablePath();
  return playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: true
  });
}

async function login(page, email, password) {
  await page.goto(process.env.HAPANA_CORE_LOGIN_URL || DEFAULT_LOGIN_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await fillFirst(page, [
    'input[name="email"]',
    'input[type="email"]',
    "#email",
    'input[name="username"]'
  ], email, "email input");

  await fillFirst(page, [
    'input[name="password"]',
    'input[type="password"]',
    "#password"
  ], password, "password input");

  const submit = await firstVisible(page, [
    'button[type="submit"]',
    'input[type="submit"]',
    ".btn-login",
    "#login-btn",
    "button.btn-primary",
    'button:has-text("Login")',
    'input[value="Login"]'
  ]);

  if (!submit) {
    throw new Error(await pageFailure(page, "Could not find the login button"));
  }

  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => null),
    submit.click()
  ]);

  await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => null);

  if (page.url().includes("/login") || page.url().includes("route=user/login")) {
    throw new Error(await pageFailure(page, "Login stayed on the login page"));
  }
}

async function selectLocation(page, locationName) {
  await page.goto(ACCOUNT_LIST_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  const locationRow = page.getByText(locationName, { exact: true }).first();
  const count = await locationRow.count();
  if (!count) {
    throw new Error(await pageFailure(
      page,
      `Could not find location "${locationName}" on the account list`
    ));
  }

  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => null),
    locationRow.click()
  ]);

  await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => null);

  if (page.url().includes("listAccounts")) {
    throw new Error(await pageFailure(
      page,
      `Clicking "${locationName}" did not leave the account list`
    ));
  }
}

async function fetchReportCsv(context, { dateFrom, dateTo }) {
  const reportUrl = new URL(REPORT_PATH, CORE_BASE_URL);
  reportUrl.searchParams.set("report_type", "client");
  reportUrl.searchParams.set("filter", "getNetRevenueDetail2");
  reportUrl.searchParams.set("removeCacheFlag", "1");
  reportUrl.searchParams.set("date_from", dateFrom);
  reportUrl.searchParams.set("date_to", dateTo);
  reportUrl.searchParams.set("downloadfile", "xls");

  const response = await context.request.get(reportUrl.toString(), { timeout: 90000 });
  const body = await response.text();

  if (!response.ok()) {
    throw new Error(`Report download failed with HTTP ${response.status()}: ${body.slice(0, 500)}`);
  }

  if (!body.trim()) {
    throw new Error("Report download returned an empty file");
  }

  if (body.trimStart().startsWith("<")) {
    throw new Error(`Report download returned HTML instead of CSV: ${body.slice(0, 500)}`);
  }

  return body;
}

async function fillFirst(page, selectors, value, label) {
  const field = await firstVisible(page, selectors);
  if (!field) {
    throw new Error(await pageFailure(page, `Could not find the ${label}`));
  }
  await field.fill(value);
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      try {
        await locator.waitFor({ state: "visible", timeout: 1500 });
        return locator;
      } catch (error) {
        // Try the next candidate selector.
      }
    }
  }
  return null;
}

async function pageFailure(page, message) {
  const body = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  return `${message}. URL: ${page.url()}. Page body: ${body.slice(0, 500)}`;
}
