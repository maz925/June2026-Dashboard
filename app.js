window.HAPANA_PROXY_URL ||= "/api/hapana";

const APP_VERSION = "dashboard-live-revenue-weeks-v2-2026-08-27";

let data = emptyWorkbook();

function emptyWorkbook() {
  return {
    source: "",
    updated: null,
    rolling: [],
    targets: [],
    dynamicTargets: [],
    latest: []
  };
}

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0
});

const number = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 1
});

const dateFormat = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short"
});

const state = {
  clubs: ["All Clubs"],
  view: "overview",
  connection: "workbook",
  customRevenueWeekEnding: null,
  trendMode: "both",
  historySort: { key: "week", dir: "desc" }
};

const clubFilter = document.querySelector("#clubFilter");
const reportDownloadForm = document.querySelector("#reportDownloadForm");
const reportLocation = document.querySelector("#reportLocation");
const reportDateFrom = document.querySelector("#reportDateFrom");
const reportDateTo = document.querySelector("#reportDateTo");
const customiseRevenueButton = document.querySelector("#customiseRevenueButton");
const customRevenuePanel = document.querySelector("#customRevenuePanel");
const revenueRangeForm = document.querySelector("#revenueRangeForm");
const revenueDateFrom = document.querySelector("#revenueDateFrom");
const revenueDateTo = document.querySelector("#revenueDateTo");
const revenueRangeStatus = document.querySelector("#revenueRangeStatus");

function uniqueLatestRows() {
  const seen = new Set();
  return data.latest.filter((row) => {
    const key = `${row.club}-${row.week}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date) {
  return dateFormat.format(date).replace(/Sept/g, "Sep");
}

const rangeFormat = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function formatRange(start, end) {
  const left = rangeFormat.format(start).replace(/Sept/g, "Sep");
  const right = rangeFormat.format(end).replace(/Sept/g, "Sep");
  return left.slice(-4) === right.slice(-4) ? `${left.replace(/ \d{4}$/, "")} to ${right}` : `${left} to ${right}`;
}

function formatInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toHapanaDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseHapanaDate(value) {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function reportingCycle(weekEnding) {
  const end = parseDate(weekEnding);
  const start = addDays(end, -6);
  const availableFrom = addDays(end, 4);
  const availableUntil = addDays(end, 10);

  return {
    period: formatRange(start, end),
    availableFrom,
    availableFromText: formatDate(availableFrom),
    availableWindow: `${formatDate(availableFrom)} to ${formatDate(availableUntil)}`,
    sortKey: weekEnding
  };
}

function rowPeriod(row) {
  if (row?.dateFrom && row?.dateTo && isCompleteRevenueWeek(row)) {
    return {
      period: formatRange(parseHapanaDate(row.dateFrom), parseHapanaDate(row.dateTo)),
      availableFromText: "Live from Hapana",
      availableWindow: "Live Hapana data is available now",
      isLive: true
    };
  }
  if (isLegacyWorkbookRevenueWeek(row)) {
    const end = parseDate(row.weekEnding);
    const start = addDays(end, -6);
    return {
      period: formatRange(start, end),
      availableFromText: "Workbook row",
      availableWindow: "Stored workbook data is available now",
      isLive: true
    };
  }
  return reportingCycle(row?.weekEnding);
}

function activeReportableWeek() {
  const weekEnding = state.customRevenueWeekEnding || availableWeekEndings()[0];
  if (!weekEnding) {
    const reportingWindow = defaultReportingWindow();
    const defaultWeekEnding = formatInputDate(reportingWindow.end);
    return { weekEnding: defaultWeekEnding, cycle: reportingCycle(defaultWeekEnding) };
  }

  const row = data.rolling.find((item) => item.weekEnding === weekEnding && hasRevenue(item)) ||
    data.rolling.find((item) => item.weekEnding === weekEnding);
  return { weekEnding, cycle: rowPeriod(row) };
}

function distinctWeekEndings() {
  return [...new Set(data.rolling.map((row) => row.weekEnding))].sort((a, b) => b.localeCompare(a));
}

function reportableWeekEndings() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return distinctWeekEndings().filter((weekEnding) =>
    data.rolling.some((row) => row.weekEnding === weekEnding && hasRevenue(row) && isCompleteRevenueWeek(row)) ||
    reportingCycle(weekEnding).availableFrom <= today
  );
}

function availableWeekEndings() {
  return reportableWeekEndings().filter((weekEnding) =>
    data.rolling.some((row) => row.weekEnding === weekEnding && hasRevenue(row) && isCompleteRevenueWeek(row))
  );
}

function isCompleteRevenueWeek(row) {
  if (isLegacyWorkbookRevenueWeek(row)) return true;
  if (!row?.dateFrom || !row?.dateTo) return parseDate(row?.weekEnding).getDay() === 0;
  const start = parseHapanaDate(row.dateFrom);
  const end = parseHapanaDate(row.dateTo);
  const isSevenDayWindow = addDays(start, 6).toDateString() === end.toDateString();
  const isMondaySunday = start.getDay() === 1 && end.getDay() === 0;
  const isFridayThursday = start.getDay() === 5 && end.getDay() === 4;
  return isSevenDayWindow && (isMondaySunday || isFridayThursday);
}

function isLegacyWorkbookRevenueWeek(row) {
  return Boolean(row?.weekEnding) &&
    !row.dateFrom &&
    !row.dateTo &&
    hasRevenue(row) &&
    parseDate(row.weekEnding).getDay() === 4;
}

function defaultReportingWindow() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceThursday = (today.getDay() - 4 + 7) % 7;
  const latestAvailableThursday = addDays(today, -daysSinceThursday);
  const end = addDays(latestAvailableThursday, -4);
  const start = addDays(end, -6);
  return { start, end };
}

function reportableRows() {
  const active = activeReportableWeek();
  return data.rolling.filter((row) => row.weekEnding === active.weekEnding);
}

function rowsForWeeks(weekEndings, { completeOnly = false } = {}) {
  const weekSet = new Set(weekEndings);
  return data.rolling.filter((row) => weekSet.has(row.weekEnding) && (!completeOnly || isCompleteRevenueWeek(row)));
}

function visible(rows) {
  const clubs = selectedClubNames();
  const filtered = isAllClubsSelected() ? rows : rows.filter((row) => clubs.includes(row.club));
  const order = window.DashboardLogic.CLUB_ORDER;
  return [...filtered].sort((a, b) => (order.indexOf(a.club) + 1 || 99) - (order.indexOf(b.club) + 1 || 99));
}

function isAllClubsSelected() {
  return state.clubs.includes("All Clubs");
}

function selectedClubNames() {
  return isAllClubsSelected() ? [] : state.clubs;
}

function selectedClubLabel() {
  return isAllClubsSelected() ? "All Clubs" : state.clubs.join(", ");
}

function syncClubSelection() {
  const values = [...clubFilter.selectedOptions].map((option) => option.value);
  state.clubs = !values.length || values.includes("All Clubs") ? ["All Clubs"] : values;
  [...clubFilter.options].forEach((option) => {
    option.selected = state.clubs.includes(option.value);
  });
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatMoney(value) {
  if (!hasValue(value)) return "Not entered";
  return money.format(value || 0);
}

function formatPercent(value) {
  if (!hasValue(value)) return "Not entered";
  return `${number.format(value || 0)}%`;
}

function totalRevenue(row) {
  return (row.ddActual || 0) + (row.posActual || 0);
}

function gapClass(value) {
  if (!hasValue(value)) return "muted-value";
  return value < 0 ? "negative" : "positive";
}

function statusClass(status) {
  return status ? String(status).toLowerCase() : "pending";
}

function statusText(status) {
  return status || "PENDING";
}

function hasRevenue(row) {
  return hasValue(row.ddActual) || hasValue(row.posActual);
}

function enrichRollingRows(rows) {
  const fixedByClub = Object.fromEntries((data.targets || []).map((row) => [row.club, row]));
  const dynamicByClub = Object.fromEntries((data.dynamicTargets || []).map((row) => [row.club, row]));

  return rows.map((row) => {
    const fixed = fixedByClub[row.club] || {};
    const dynamic = dynamicByClub[row.club] || {};
    const ddTarget = dynamic.realisticDDTarget || fixed.ddTarget || row.ddTarget || null;
    const targetPercent = dynamic.realisticPOSPercentTarget || fixed.posTargetPercent || row.targetPercent || null;
    const ddGap = hasValue(row.ddActual) && hasValue(ddTarget) ? round2(row.ddActual - ddTarget) : row.ddGap;
    const posPercent = hasValue(row.posPercent)
      ? row.posPercent
      : row.ddActual ? round1((row.posActual / row.ddActual) * 100) : null;
    const status = hasRevenue(row) && hasValue(ddGap) && hasValue(targetPercent)
      ? ddGap >= 0 && posPercent >= targetPercent ? "GREEN" : "RED"
      : row.status;

    return {
      ...row,
      ddTarget,
      ddGap,
      posPercent,
      targetPercent,
      status
    };
  });
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function formatGap(row) {
  return hasRevenue(row) ? formatMoney(row.ddGap) : "Pending";
}

function gapDisplayClass(row) {
  return hasRevenue(row) ? gapClass(row.ddGap) : "muted-value";
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
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

async function loadLiveData() {
  const fetchImpl = window.DashboardUI?.fetch || window.dashboardAuth?.fetch || fetch;
  try {
    const workbookResponse = await fetchImpl("/api/workbook", { headers: { "Accept": "application/json" } });
    if (workbookResponse.ok) {
      const workbook = await workbookResponse.json();
      if (Array.isArray(workbook.rolling)) data = { ...emptyWorkbook(), ...workbook };
    }
  } catch (error) {
    console.warn("Workbook fallback could not load.", error);
  }

  const proxyUrl = window.HAPANA_PROXY_URL || "";
  if (!proxyUrl) {
    state.connection = data.rolling.length ? "workbook" : "fallback";
    return;
  }

  try {
    const response = await fetchImpl(proxyUrl, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Hapana proxy returned ${response.status}`);

    const liveData = await response.json();
    if (!Array.isArray(liveData.rolling)) {
      throw new Error("Hapana proxy returned invalid rolling rows");
    }

    if (liveData.rolling.length === 0) {
      state.connection = Array.isArray(liveData.sites) && liveData.sites.length ? "liveMetadata" : "fallback";
      data = {
        ...data,
        ...liveData,
        rolling: []
      };
      return;
    }

    data = {
      ...data,
      ...liveData,
      rolling: liveData.rolling,
      targets: liveData.targets || data.targets,
      dynamicTargets: liveData.dynamicTargets || data.dynamicTargets
    };
    data.rolling = enrichRollingRows(data.rolling);
    state.connection = "live";
  } catch (error) {
    state.connection = "fallback";
    console.warn("Using workbook data because Hapana live data could not load.", error);
  }
}

function mergeRollingRows(existingRows, liveRows) {
  const rowsByKey = new Map(existingRows.map((row) => [rollingRowKey(row), row]));
  for (const row of liveRows) {
    rowsByKey.set(rollingRowKey(row), row);
  }
  return [...rowsByKey.values()].sort((a, b) =>
    a.weekEnding.localeCompare(b.weekEnding) ||
    String(a.dateFrom || "").localeCompare(String(b.dateFrom || "")) ||
    String(a.dateTo || "").localeCompare(String(b.dateTo || "")) ||
    a.club.localeCompare(b.club)
  );
}

function rollingRowKey(row) {
  return `${row.weekEnding}|${row.dateFrom || ""}|${row.dateTo || ""}|${row.club}`;
}

async function updateRevenueRange() {
  const button = revenueRangeForm.querySelector("button");
  const originalText = button.textContent;
  const selected = selectedClubNames();
  if (selected.length !== 1) {
    revenueRangeStatus.textContent = "Select exactly one club first, then update the custom revenue range.";
    return;
  }
  const club = selected[0];

  button.disabled = true;
  button.textContent = "Updating...";
  const dateFrom = toHapanaDate(readDate(revenueDateFrom));
  const dateTo = toHapanaDate(readDate(revenueDateTo));
  revenueRangeStatus.textContent = `Updating ${club} from Core Hapana...`;

  try {
    const params = new URLSearchParams({ club, date_from: dateFrom, date_to: dateTo });
    const body = await fetchRevenueRange(params);
    const refreshedRows = (body.rolling || []).filter((item) =>
      item.club === club && item.dateFrom === dateFrom && item.dateTo === dateTo
    );

    if (!refreshedRows.length) {
      throw new Error(`No revenue row was returned for ${club} in that date range.`);
    }

    data = {
      ...data,
      ...body,
      rolling: enrichRollingRows(mergeRollingRows(data.rolling, refreshedRows)),
      targets: body.targets || data.targets,
      dynamicTargets: body.dynamicTargets || data.dynamicTargets
    };
    state.connection = "live";
    state.customRevenueWeekEnding = body.weekEnding || null;
    renderSource();
    render();

    const failures = Array.isArray(body.failures)
      ? body.failures.map((item) => `${item.club || club}: ${errorText(item.error)}`)
      : [];
    revenueRangeStatus.textContent = failures.length
      ? `Finished with issues: ${failures.join(" | ")}`
      : `${club} revenue data updated.`;
  } catch (error) {
    revenueRangeStatus.textContent = errorText(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function fetchRevenueRange(params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 295000);

  try {
    const response = await (window.DashboardUI?.fetch || fetch)(`/api/weekly-revenue?${params.toString()}`, {
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) {
      throw new Error(errorText(body.error || body || `HTTP ${response.status}`));
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Core Hapana took too long for one club. Try a shorter date range.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function renderMetrics() {
  const targetRows = visible(data.targets);
  const rows = visible(metricRows());
  const isTargetView = state.view === "targets";
  const hasAnyRevenue = rows.some(hasRevenue);
  const totalDD = isTargetView
    ? targetRows.reduce((sum, row) => sum + (row.ddTarget || 0), 0)
    : rows.reduce((sum, row) => sum + (row.ddActual || 0), 0);
  const totalPOS = isTargetView
    ? targetRows.reduce((sum, row) => sum + (row.posTargetDollars || 0), 0)
    : rows.reduce((sum, row) => sum + (row.posActual || 0), 0);
  const totalRevenue = totalDD + totalPOS;
  const avgPOS = totalDD ? (totalPOS / totalDD) * 100 : 0;

  const periodName = {
    overview: "4-week actual",
    latest: "Latest week actual",
    history: "12-week actual",
    targets: "Target, not actual"
  }[state.view] || "Actual";
  document.querySelector("#totalDD").previousElementSibling.textContent = isTargetView ? "Target DD" : "Total DD";
  document.querySelector("#totalPOS").previousElementSibling.textContent = isTargetView ? "Target POS" : "Total POS";
  document.querySelector("#totalRevenue").previousElementSibling.textContent = isTargetView ? "Target revenue" : "Total revenue";
  document.querySelector("#avgPOS").previousElementSibling.textContent = isTargetView ? "Target POS %" : "Avg POS %";
  document.querySelector("#metricPeriod")?.replaceChildren(document.createTextNode(periodName));

  setText("#totalDD", isTargetView || hasAnyRevenue ? formatMoney(totalDD) : "Not entered");
  setText("#totalPOS", isTargetView || hasAnyRevenue ? formatMoney(totalPOS) : "Not entered");
  setText("#totalRevenue", isTargetView || hasAnyRevenue ? formatMoney(totalRevenue) : "Not entered");
  setText("#avgPOS", isTargetView || hasAnyRevenue ? formatPercent(avgPOS) : "Not entered");
}

function metricRows() {
  if (state.view === "latest") return reportableRows();
  if (state.customRevenueWeekEnding && state.view === "overview") return rowsForWeeks([state.customRevenueWeekEnding]);
  if (state.view === "overview") return rowsForWeeks(availableWeekEndings().slice(0, 4), { completeOnly: true });
  if (state.view === "history") return rowsForWeeks(availableWeekEndings().slice(0, 12), { completeOnly: true });
  return [];
}

function renderCycle() {
  const active = activeReportableWeek();
  setText("#cyclePeriod", active.cycle.period);
  setText("#cycleWindow", active.cycle.isLive
    ? active.cycle.availableWindow
    : `${active.cycle.availableWindow}, then the next cycle takes over`);
}

function renderSummary() {
  const container = document.querySelector("#summaryGrid");
  const overviewRows = state.customRevenueWeekEnding
    ? rowsForWeeks([state.customRevenueWeekEnding])
    : rowsForWeeks(availableWeekEndings().slice(0, 4), { completeOnly: true });
  const rowsByClub = visible(overviewRows).reduce((groups, row) => {
    groups[row.club] ||= [];
    groups[row.club].push(row);
    return groups;
  }, {});

  container.innerHTML = Object.entries(rowsByClub).map(([club, rows]) => {
    const totalDD = rows.reduce((sum, row) => sum + (row.ddActual || 0), 0);
    const totalPOS = rows.reduce((sum, row) => sum + (row.posActual || 0), 0);
    const ddGap = rows.reduce((sum, row) => sum + (hasRevenue(row) ? row.ddGap || 0 : 0), 0);
    const posPercent = totalDD ? (totalPOS / totalDD) * 100 : null;
    const redWeeks = rows.filter((row) => row.status === "RED").length;
    const greenWeeks = rows.filter((row) => row.status === "GREEN").length;

    return `
    <article class="club-card">
      <div class="card-head">
        <span class="club-name">${club}</span>
        <span class="status ${redWeeks > greenWeeks ? "red" : "green"}">${redWeeks} red / ${greenWeeks} green</span>
      </div>
      <div class="mini-grid">
        <span><span class="mini-label">Total DD</span><strong class="mini-value">${formatMoney(totalDD)}</strong></span>
        <span><span class="mini-label">Total POS</span><strong class="mini-value">${formatMoney(totalPOS)}</strong></span>
        <span><span class="mini-label">POS %</span><strong class="mini-value">${formatPercent(posPercent)}</strong></span>
        <span><span class="mini-label">DD Gap vs Realistic</span><strong class="mini-value ${gapClass(ddGap)}">${formatMoney(ddGap)}</strong></span>
      </div>
    </article>
    `;
  }).join("");
}

function performanceFor(row) {
  const dynamic = (data.dynamicTargets || []).find((item) => item.club === row.club) || {};
  return window.DashboardLogic.assessPerformance({
    ...row,
    stretchPOSPercent: dynamic.stretchPOSPercentTarget
  });
}

function performanceMessage(row, assessment) {
  if (!hasRevenue(row)) return "Revenue has not been entered for this reportable week yet.";
  if (assessment.status === "GREEN") {
    return assessment.aboveStretch
      ? `On track against Realistic DD and the Realistic POS target of ${formatPercent(row.targetPercent)}. POS % ${formatPercent(row.posPercent)} is also above the stretch POS target.`
      : `On track: DD is at or above Realistic DD and POS % is at or above the Realistic POS target of ${formatPercent(row.targetPercent)}.`;
  }
  const parts = [];
  if (assessment.missed.includes("DD")) {
    parts.push(`DD missed Realistic DD (${formatMoney(row.ddActual)} vs ${formatMoney(row.ddTarget)}, gap ${formatGap(row)})`);
  }
  if (assessment.missed.includes("POS")) {
    parts.push(`POS % ${formatPercent(row.posPercent)} missed the Realistic POS target of ${formatPercent(row.targetPercent)}`);
  }
  return parts.length ? `${parts.join(". ")}.` : "Red status, but the missed target could not be identified.";
}

function renderLatest() {
  const latest = visible(reportableRows());
  const container = document.querySelector("#latestGrid");

  container.innerHTML = latest.map((row) => {
    const assessment = performanceFor(row);
    const progress = Math.max(0, Math.min(100, row.targetPercent ? (row.posPercent / row.targetPercent) * 100 : 0));
    const cycle = rowPeriod(row);
    return `
      <article class="latest-card">
        <div class="card-head">
          <span class="club-name">${escapeHtml(row.club)}</span>
          <span class="status ${statusClass(assessment.status)}">${escapeHtml(assessment.badge)}</span>
        </div>
        <div class="mini-grid">
          <span><span class="mini-label">Revenue Period</span><strong class="mini-value">${escapeHtml(cycle.period)}</strong></span>
          <span><span class="mini-label">Reportable From</span><strong class="mini-value">${escapeHtml(cycle.availableFromText)}</strong></span>
          <span><span class="mini-label">DD Actual</span><strong class="mini-value">${formatMoney(row.ddActual)}</strong></span>
          <span><span class="mini-label">DD Gap vs Realistic</span><strong class="mini-value ${gapDisplayClass(row)}">${formatGap(row)}</strong></span>
          <span><span class="mini-label">POS Actual</span><strong class="mini-value">${formatMoney(row.posActual)}</strong></span>
          <span><span class="mini-label">POS % vs Realistic</span><strong class="mini-value">${formatPercent(row.posPercent)}</strong></span>
        </div>
        <div class="progress" aria-label="POS progress to the Realistic POS target"><span style="width:${progress}%"></span></div>
        <p class="note">${escapeHtml(performanceMessage(row, assessment))}</p>
      </article>
    `;
  }).join("");
}

function renderTargets() {
  const fixedByClub = Object.fromEntries((data.targets || []).map((row) => [row.club, row]));
  const rows = visible(data.dynamicTargets || []);
  const container = document.querySelector("#targetGrid");

  container.innerHTML = rows.map((row) => {
    const fixed = fixedByClub[row.club] || {};
    return `
      <article class="target-card">
        <div class="card-head">
          <span class="club-name">${row.club}</span>
          <span class="status amber">target</span>
        </div>
        <div class="mini-grid">
          <span><span class="mini-label">Baseline DD</span><strong class="mini-value">${formatMoney(fixed.ddTarget)}</strong></span>
          <span><span class="mini-label">Rolling Avg DD</span><strong class="mini-value">${formatMoney(row.rollingAvgDD)}</strong></span>
          <span><span class="mini-label">Realistic DD</span><strong class="mini-value">${formatMoney(row.realisticDDTarget)}</strong></span>
          <span><span class="mini-label">Stretch DD</span><strong class="mini-value">${formatMoney(row.stretchDDTarget)}</strong></span>
          <span><span class="mini-label">Realistic POS</span><strong class="mini-value">${formatPercent(row.realisticPOSPercentTarget)}</strong></span>
          <span><span class="mini-label">Stretch POS</span><strong class="mini-value">${formatPercent(row.stretchPOSPercentTarget)}</strong></span>
        </div>
        <p class="note">${escapeHtml(targetCardNote(row, fixed))}</p>
      </article>
    `;
  }).join("");
}

function targetCardNote(row, fixed) {
  const parts = [
    `These are targets, not actuals. DD gap and red/green status compare actuals with Realistic DD (${formatMoney(row.realisticDDTarget)}) and Realistic POS % (${formatPercent(row.realisticPOSPercentTarget)}).`,
    `Stretch POS % is ${formatPercent(row.stretchPOSPercentTarget)}.`
  ];
  if (window.DashboardLogic.stretchBelowBaseline(row, fixed)) {
    parts.push(`Stretch DD ${formatMoney(row.stretchDDTarget)} is below the baseline DD of ${formatMoney(fixed.ddTarget)}. Stored targets were not changed.`);
  }
  return parts.join(" ");
}

function renderRevenueTrend() {
  const container = document.querySelector("#revenueTrend");
  const weeks = availableWeekEndings().slice(0, 12).reverse();
  const allRows = rowsForWeeks(weeks).filter((row) => hasRevenue(row) && isCompleteRevenueWeek(row));

  if (!weeks.length || !allRows.length) {
    container.innerHTML = `<p class="trend-empty">No revenue data available for the selected period.</p>`;
    return;
  }

  const clubNames = [...new Set(allRows.map((row) => row.club))].sort((a, b) => a.localeCompare(b));
  const visibleClubNames = isAllClubsSelected() ? clubNames : clubNames.filter((club) => selectedClubNames().includes(club));
  const chartClubs = [isAllClubsSelected() ? "All Clubs" : "Selected Clubs", ...visibleClubNames];
  const colors = {
    "All Clubs": "#17202a",
    "Selected Clubs": "#17202a",
    "Bankstown": "#c8112e",
    "Wetherill Park": "#1f7a4d",
    "580G": "#2f6fd6",
    "Woolooware": "#a15c00"
  };

  const series = chartClubs.map((club) => ({
    club,
    total: club === "All Clubs" || club === "Selected Clubs",
    color: colors[club] || "#667085",
    values: weeks.map((weekEnding) => {
      const weekRows = allRows.filter((row) => row.weekEnding === weekEnding);
      const rows = club === "All Clubs"
        ? weekRows
        : club === "Selected Clubs"
          ? weekRows.filter((row) => selectedClubNames().includes(row.club))
          : weekRows.filter((row) => row.club === club);
      return rows.reduce((sum, row) => sum + totalRevenue(row), 0);
    })
  })).filter((item) => item.total || item.values.some((value) => value > 0));
  const shown = series.filter((item) => {
    if (state.trendMode === "total") return item.total;
    if (state.trendMode === "clubs") return !item.total;
    return true;
  });
  const totalSeries = shown.filter((item) => item.total);
  const clubSeries = shown.filter((item) => !item.total);
  const splitAxis = state.trendMode === "both" && totalSeries.length && clubSeries.length;

  const width = 980;
  const height = 360;
  const pad = { top: 22, right: splitAxis ? 78 : 28, bottom: 72, left: 82 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxOf = (items) => Math.max(1, ...items.flatMap((item) => item.values));
  const stepFor = (maxValue) => maxValue > 100000 ? 20000 : 5000;
  const leftMaxValue = maxOf(splitAxis ? totalSeries : shown);
  const rightMaxValue = splitAxis ? maxOf(clubSeries) : leftMaxValue;
  const leftStep = stepFor(leftMaxValue);
  const rightStep = stepFor(rightMaxValue);
  const leftMax = Math.max(leftStep, Math.ceil(leftMaxValue / leftStep) * leftStep);
  const rightMax = Math.max(rightStep, Math.ceil(rightMaxValue / rightStep) * rightStep);
  const x = (index) => pad.left + (weeks.length === 1 ? plotWidth / 2 : (index / (weeks.length - 1)) * plotWidth);
  const yFor = (value, max) => pad.top + plotHeight - (value / max) * plotHeight;
  const leftTicks = Array.from({ length: Math.floor(leftMax / leftStep) + 1 }, (_, index) => index * leftStep);
  const rightTicks = Array.from({ length: Math.floor(rightMax / rightStep) + 1 }, (_, index) => index * rightStep);

  const grid = leftTicks.map((tick) => `
    <line class="trend-grid" x1="${pad.left}" y1="${yFor(tick, leftMax)}" x2="${width - pad.right}" y2="${yFor(tick, leftMax)}"></line>
    <text class="trend-label" x="${pad.left - 12}" y="${yFor(tick, leftMax) + 4}" text-anchor="end">${formatMoney(tick)}</text>
  `).join("") + (splitAxis ? rightTicks.map((tick) => `
    <text class="trend-label" x="${width - pad.right + 12}" y="${yFor(tick, rightMax) + 4}">${formatMoney(tick)}</text>
  `).join("") : "");

  const xLabels = weeks.map((weekEnding, index) => `
    <text class="trend-label" x="${x(index)}" y="${height - 46}" text-anchor="end" transform="rotate(-40 ${x(index)} ${height - 46})">${formatDate(parseDate(weekEnding)).replace(/^[A-Za-z]{3},\s*/, "")}</text>
  `).join("");

  const paths = shown.map((item) => {
    const max = splitAxis && !item.total ? rightMax : leftMax;
    const points = item.values.map((value, index) => `${x(index)},${yFor(value, max)}`);
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point}`).join(" ");
    const dots = item.values.map((value, index) => {
      const sample = allRows.find((row) => row.weekEnding === weeks[index]);
      const range = sample ? rowPeriod(sample).period : formatDate(parseDate(weeks[index]));
      const tip = `${item.club}: ${range}. Revenue ${formatMoney(value)}.`;
      return `
      <circle class="trend-dot" data-tip="${escapeHtml(tip)}" cx="${x(index)}" cy="${yFor(value, max)}" r="${item.total ? 4.8 : 3.8}" fill="${item.color}">
        <title>${escapeHtml(tip)}</title>
      </circle>`;
    }).join("");
    return `<path class="trend-line" d="${path}" stroke="${item.color}"></path>${dots}`;
  }).join("");

  const legend = shown.map((item) => `
    <span><i class="trend-swatch" style="background:${item.color}"></i>${escapeHtml(item.club)}${splitAxis && !item.total ? " (right axis)" : ""}</span>
  `).join("");
  const modes = [
    ["both", "Total and clubs"],
    ["total", "Total only"],
    ["clubs", "Clubs only"]
  ].map(([mode, label]) => `<button type="button" class="trend-toggle${state.trendMode === mode ? " is-on" : ""}" data-trend="${mode}">${label}</button>`).join("");

  container.innerHTML = `
    <div class="trend-toolbar">${modes}<span class="trend-axis-note">${splitAxis ? "Left axis is the combined total. Right axis is each club, so club lines stay readable." : "One axis for the lines on this chart."}</span></div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="12 week total revenue line graph">
      ${grid}
      <line class="trend-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
      <line class="trend-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
      ${xLabels}
      ${paths}
    </svg>
    <p class="chart-tooltip" hidden></p>
    <div class="trend-legend">${legend}</div>
  `;
  container.querySelectorAll("[data-trend]").forEach((button) => {
    button.addEventListener("click", () => {
      state.trendMode = button.dataset.trend;
      renderRevenueTrend();
    });
  });
  const tip = container.querySelector(".chart-tooltip");
  container.querySelectorAll(".trend-dot").forEach((dot) => {
    dot.addEventListener("mouseenter", () => {
      tip.hidden = false;
      tip.textContent = dot.dataset.tip;
    });
    dot.addEventListener("mouseleave", () => {
      tip.hidden = true;
    });
  });
}

function historyHeader(key, label) {
  const active = state.historySort.key === key;
  const arrow = active ? (state.historySort.dir === "asc" ? " ↑" : " ↓") : "";
  return `<th><button type="button" data-sort="${key}">${label}${arrow}</button></th>`;
}

function renderHistory() {
  renderRevenueTrend();
  const rows = visible(rowsForWeeks(availableWeekEndings().slice(0, 12), { completeOnly: true }));
  const body = document.querySelector("#historyBody");
  const head = body?.closest("table")?.querySelector("thead");
  if (head) {
    head.innerHTML = `<tr>
      ${historyHeader("week", "Week")}
      ${historyHeader("available", "Reportable from")}
      ${historyHeader("club", "Club")}
      ${historyHeader("dd", "DD actual")}
      ${historyHeader("gap", "DD gap vs Realistic")}
      ${historyHeader("pos", "POS actual")}
      ${historyHeader("percent", "POS %")}
      ${historyHeader("status", "Status")}
    </tr>`;
    head.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sort;
        state.historySort = {
          key,
          dir: state.historySort.key === key && state.historySort.dir === "desc" ? "asc" : "desc"
        };
        renderHistory();
      });
    });
  }
  const direction = state.historySort.dir === "asc" ? 1 : -1;
  const weekValue = (group) => {
    const dd = group.reduce((sum, row) => sum + (row.ddActual || 0), 0);
    const pos = group.reduce((sum, row) => sum + (row.posActual || 0), 0);
    const gap = group.reduce((sum, row) => sum + (hasRevenue(row) ? row.ddGap || 0 : 0), 0);
    return {
      week: group[0].weekEnding,
      available: group[0].weekEnding,
      club: group[0].club,
      dd,
      gap,
      pos,
      percent: dd ? pos / dd * 100 : 0,
      status: group.filter((row) => performanceFor(row).status === "RED").length
    }[state.historySort.key];
  };
  const groups = [...rows.reduce((map, row) => {
    const list = map.get(row.weekEnding) || [];
    list.push(row);
    map.set(row.weekEnding, list);
    return map;
  }, new Map()).values()].sort((a, b) => {
    const left = weekValue(a);
    const right = weekValue(b);
    return (left > right ? 1 : left < right ? -1 : 0) * direction;
  });
  body.innerHTML = groups.map((group) => {
    const ordered = [...group].sort((a, b) => window.DashboardLogic.CLUB_ORDER.indexOf(a.club) - window.DashboardLogic.CLUB_ORDER.indexOf(b.club));
    const lines = ordered.map((row) => {
      const cycle = rowPeriod(row);
      const assessment = performanceFor(row);
      return `
        <tr>
          <td>${escapeHtml(cycle.period)}</td>
          <td>${escapeHtml(cycle.availableFromText)}</td>
          <td>${escapeHtml(row.club)}</td>
          <td>${formatMoney(row.ddActual)}</td>
          <td class="${gapDisplayClass(row)}">${formatGap(row)}</td>
          <td>${formatMoney(row.posActual)}</td>
          <td>${formatPercent(row.posPercent)}</td>
          <td><span class="status ${statusClass(assessment.status)}">${escapeHtml(assessment.badge)}</span></td>
        </tr>`;
    }).join("");
    const totalDD = group.reduce((sum, row) => sum + (row.ddActual || 0), 0);
    const totalPOS = group.reduce((sum, row) => sum + (row.posActual || 0), 0);
    const gap = group.reduce((sum, row) => sum + (hasRevenue(row) ? row.ddGap || 0 : 0), 0);
    return `${lines}<tr class="week-total"><td>${escapeHtml(rowPeriod(group[0]).period)}</td><td></td><td>Week total</td><td>${formatMoney(totalDD)}</td><td class="${gapClass(gap)}">${formatMoney(gap)}</td><td>${formatMoney(totalPOS)}</td><td>${formatPercent(totalDD ? totalPOS / totalDD * 100 : null)}</td><td></td></tr>`;
  }).join("");
}

function financialWeekTotals(weekEnding, clubs) {
  const rows = data.rolling.filter((row) => row.weekEnding === weekEnding && isCompleteRevenueWeek(row));
  const selected = clubs.map((club) => rows.find((row) => row.club === club &&
    Number.isFinite(row.ddActual) && Number.isFinite(row.posActual)));
  if (!selected.length || selected.some((row) => !row)) return null;
  const dd = selected.reduce((sum, row) => sum + row.ddActual, 0);
  const pos = selected.reduce((sum, row) => sum + row.posActual, 0);
  return { dd, pos, revenue: dd + pos, posPercent: dd ? pos / dd * 100 : null };
}

function financialChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const difference = current - previous;
  return { difference, percent: previous === 0 ? null : difference / Math.abs(previous) * 100 };
}

function renderFinancialComparison() {
  const container = document.querySelector("#financialComparison");
  if (!container) return;
  const currentWeek = availableWeekEndings()[0];
  if (!currentWeek) {
    setText("#financialComparisonNote", "No completed revenue weeks are available yet.");
    container.innerHTML = "";
    return;
  }
  const previousWeek = formatInputDate(addDays(parseDate(currentWeek), -7));
  const clubs = isAllClubsSelected()
    ? [...new Set([...data.targets.map((row) => row.club), ...data.rolling.map((row) => row.club)])].filter(Boolean)
    : selectedClubNames();
  const current = financialWeekTotals(currentWeek, clubs);
  const previous = financialWeekTotals(previousWeek, clubs);
  const range = (week) => {
    const row = data.rolling.find((item) => item.weekEnding === week && isCompleteRevenueWeek(item));
    return row ? rowPeriod(row).period : reportingCycle(week).period;
  };
  setText("#financialComparisonNote", `${clubs.join(", ")} · Current means the latest available completed week. ${!current || !previous ? "A week is unavailable if any selected club is missing DD or POS data. " : ""}POS % is POS divided by DD; its change is in percentage points.`);
  const signed = (value, format) => `${value > 0 ? "+" : ""}${format(value)}`;
  const metrics = [
    { key: "dd", label: "DD Revenue" },
    { key: "pos", label: "POS Revenue" },
    { key: "revenue", label: "Total Revenue" },
    { key: "posPercent", label: "POS % of DD", ratio: true }
  ];
  container.innerHTML = `<table>
    <thead><tr><th scope="col">Measure</th><th scope="col">Last week<br>${escapeHtml(range(previousWeek))}</th><th scope="col">Current week<br>${escapeHtml(range(currentWeek))}</th><th scope="col">Change</th><th scope="col">Change %</th><th scope="col">Direction</th></tr></thead>
    <tbody>${metrics.map((metric) => {
      const before = previous?.[metric.key];
      const after = current?.[metric.key];
      const change = financialChange(after, before);
      const format = metric.ratio ? formatPercent : formatMoney;
      const display = (value) => Number.isFinite(value) ? format(value) : "Unavailable";
      const direction = !change ? "Unavailable" : change.difference > 0 ? "Up" : change.difference < 0 ? "Down" : "No change";
      const changeText = !change ? "—" : metric.ratio ? `${signed(change.difference, (value) => number.format(value))} pp` : signed(change.difference, formatMoney);
      return `<tr><th scope="row">${metric.label}</th><td>${display(before)}</td><td>${display(after)}</td><td class="${change ? gapClass(change.difference) : "muted-value"}">${changeText}</td><td>${metric.ratio ? "—" : !change ? "—" : change.percent === null ? "N/A (last week was zero)" : signed(change.percent, formatPercent)}</td><td>${direction}</td></tr>`;
    }).join("")}</tbody></table>`;
}

function render() {
  renderFinancialComparison();
  renderMetrics();
  renderCycle();
  renderSummary();
  renderLatest();
  renderTargets();
  renderHistory();
  renderAttentionPanel();
}

function renderAttentionPanel() {
  const latest = visible(reportableRows()).filter(hasRevenue);
  const items = [];
  const misses = latest.map((row) => ({ row, assessment: performanceFor(row) })).filter((item) => item.assessment.status === "RED");
  if (misses.length) {
    const worst = [...misses].sort((a, b) => (a.row.ddGap || 0) - (b.row.ddGap || 0))[0];
    const detail = misses.map((item) => `${item.row.club} missed ${item.assessment.missed.join(" and ") || "a target"}`).join("; ");
    items.push({ tone: "bad", text: `${detail}. Largest Realistic DD gap is ${worst.row.club} ${formatGap(worst.row)}.` });
  } else if (latest.length) {
    items.push({ tone: "good", text: "Latest week: every selected club is on track against Realistic DD and Realistic POS %." });
  }
  for (const dynamic of data.dynamicTargets || []) {
    const fixed = (data.targets || []).find((row) => row.club === dynamic.club);
    if (!fixed || ( !isAllClubsSelected() && !selectedClubNames().includes(dynamic.club))) continue;
    if (window.DashboardLogic.stretchBelowBaseline(dynamic, fixed)) {
      items.push({ tone: "watch", text: `${dynamic.club} stretch DD ${formatMoney(dynamic.stretchDDTarget)} is below baseline DD ${formatMoney(fixed.ddTarget)}. Stored targets were not changed.` });
    }
  }
  window.DashboardUI?.renderAttention(items);
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${view}View`);
  });
  renderMetrics();
  logDashboardView();
}

function initControls() {
  const clubs = window.DashboardLogic.orderClubs(["All Clubs", ...new Set([
    ...data.rolling.map((row) => row.club),
    ...(data.targets || []).map((row) => row.club),
    ...(data.dynamicTargets || []).map((row) => row.club)
  ])].filter(Boolean));
  clubFilter.multiple = true;
  clubFilter.size = Math.min(5, clubs.length);
  clubFilter.innerHTML = clubs.map((club) => `<option value="${escapeHtml(club)}"${club === "All Clubs" ? " selected" : ""}>${escapeHtml(club)}</option>`).join("");

  const today = new Date();
  const fourWeeksAgo = addDays(today, -27);
  revenueDateFrom.value = formatInputDate(fourWeeksAgo);
  revenueDateTo.value = formatInputDate(today);
  const reportingWindow = defaultReportingWindow();
  reportDateFrom.value = formatInputDate(reportingWindow.start);
  reportDateTo.value = formatInputDate(reportingWindow.end);
}

function renderSource() {
  const status = {
    live: "Live Hapana data",
    liveMetadata: "Hapana connected, workbook revenue",
    fallback: "Workbook fallback",
    workbook: "Workbook data"
  }[state.connection];

  setText("#connectionStatus", status);
  setText("#sourceName", data.source || "Hapana");
  window.DashboardUI?.paintFreshness(data.updated, APP_VERSION);
}

clubFilter.addEventListener("change", () => {
  syncClubSelection();
  render();
  logDashboardView();
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

customiseRevenueButton.addEventListener("click", () => {
  const shouldOpen = customRevenuePanel.hidden;
  customRevenuePanel.hidden = !shouldOpen;
  customiseRevenueButton.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) applyViewDateDefaults();
});

revenueRangeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateRevenueRange();
});

reportDownloadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const params = new URLSearchParams({
    location: reportLocation.value,
    date_from: toHapanaDate(readDate(reportDateFrom)),
    date_to: toHapanaDate(readDate(reportDateTo))
  });
  try {
    const response = await (window.DashboardUI?.fetch || fetch)(`/api/core-report?${params.toString()}`);
    if (!response.ok) throw new Error(`Download failed (${response.status}). Sign in and try again.`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `net-revenue-${reportLocation.value}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    revenueRangeStatus.textContent = errorText(error);
  }
});

function readDate(input) {
  return window.DashboardUI ? window.DashboardUI.readDateInput(input) : input.value;
}

function applyViewDateDefaults() {
  const count = state.view === "latest" ? 1 : state.view === "history" ? 12 : 4;
  const weeks = availableWeekEndings().slice(0, count);
  if (!weeks.length) return;
  const end = parseDate(weeks[0]);
  const start = addDays(parseDate(weeks[weeks.length - 1]), -6);
  window.DashboardUI?.setDateInput(revenueDateFrom, formatInputDate(start));
  window.DashboardUI?.setDateInput(revenueDateTo, formatInputDate(end));
}

async function init() {
  try {
    window.DashboardUI?.showStatus("Loading financial data…");
    await window.dashboardAuth?.ready;
    await loadLiveData();
    initControls();
    window.DashboardUI?.enhanceDateInputs(document);
    applyViewDateDefaults();
    window.DashboardUI?.installClubFilter(clubFilter);
    syncClubSelection();
    renderSource();
    render();
    document.body.classList.remove("dashboard-pending");
    window.DashboardUI?.hideStatus();
    logDashboardView();
  } catch (error) {
    document.body.classList.remove("dashboard-pending");
    window.DashboardUI?.showStatus(errorText(error), "error");
  }
}

init();

function logDashboardView() {
  window.dashboardAuth?.logView?.({
    page: "DD / POS",
    view: state.view,
    club: selectedClubLabel()
  });
}
