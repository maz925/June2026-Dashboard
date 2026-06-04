window.HAPANA_PROXY_URL ||= window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? ""
  : "/api/hapana";

const APP_VERSION = "dashboard-live-reportable-window-v2-2026-06-04";

let data = window.TRACKER_DATA;

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
  club: "All Clubs",
  view: "overview",
  connection: "workbook"
};

const clubFilter = document.querySelector("#clubFilter");
const reportDownloadForm = document.querySelector("#reportDownloadForm");
const reportLocation = document.querySelector("#reportLocation");
const reportDateFrom = document.querySelector("#reportDateFrom");
const reportDateTo = document.querySelector("#reportDateTo");

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
  return dateFormat.format(date);
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
  const availableFrom = addDays(end, 7);
  const availableUntil = addDays(end, 13);

  return {
    period: `${formatDate(start)} to ${formatDate(end)}`,
    availableFrom,
    availableFromText: formatDate(availableFrom),
    availableWindow: `${formatDate(availableFrom)} to ${formatDate(availableUntil)}`,
    sortKey: weekEnding
  };
}

function rowPeriod(row) {
  if (row?.dateFrom && row?.dateTo) {
    return {
      period: `${formatDate(parseHapanaDate(row.dateFrom))} to ${formatDate(parseHapanaDate(row.dateTo))}`,
      availableFromText: "Live from Hapana",
      availableWindow: "Live Hapana data is available now",
      isLive: true
    };
  }
  return reportingCycle(row?.weekEnding);
}

function activeReportableWeek() {
  const weekEnding = availableWeekEndings()[0] || data.rolling[0]?.weekEnding;
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
  return distinctWeekEndings().filter((weekEnding) => reportingCycle(weekEnding).availableFrom <= today);
}

function availableWeekEndings() {
  return reportableWeekEndings().filter((weekEnding) =>
    data.rolling.some((row) => row.weekEnding === weekEnding && hasRevenue(row) && isCompleteRevenueWeek(row))
  );
}

function isCompleteRevenueWeek(row) {
  if (!row?.dateFrom || !row?.dateTo) return true;
  const start = parseHapanaDate(row.dateFrom);
  const end = parseHapanaDate(row.dateTo);
  return start.getDay() === 5 && end.getDay() === 4 && addDays(start, 6).toDateString() === end.toDateString();
}

function reportableRows() {
  const active = activeReportableWeek();
  return data.rolling.filter((row) => row.weekEnding === active.weekEnding);
}

function rowsForWeeks(weekEndings) {
  const weekSet = new Set(weekEndings);
  return data.rolling.filter((row) => weekSet.has(row.weekEnding));
}

function visible(rows) {
  return state.club === "All Clubs" ? rows : rows.filter((row) => row.club === state.club);
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
  const fixedByClub = Object.fromEntries(data.targets.map((row) => [row.club, row]));
  const dynamicByClub = Object.fromEntries(data.dynamicTargets.map((row) => [row.club, row]));

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
  document.querySelector(selector).textContent = value;
}

async function loadLiveData() {
  const proxyUrl = window.HAPANA_PROXY_URL || "";
  if (!proxyUrl) {
    state.connection = "workbook";
    return;
  }

  try {
    const response = await fetch(proxyUrl, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Hapana proxy returned ${response.status}`);

    const liveData = await response.json();
    if (!Array.isArray(liveData.rolling)) {
      throw new Error("Hapana proxy returned invalid rolling rows");
    }

    if (liveData.rolling.length === 0) {
      state.connection = Array.isArray(liveData.sites) && liveData.sites.length ? "liveMetadata" : "fallback";
      return;
    }

    const rolling = mergeRollingRows(data.rolling, liveData.rolling);
    data = {
      ...data,
      ...liveData,
      rolling,
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
  const rowsByKey = new Map(existingRows.map((row) => [`${row.weekEnding}|${row.club}`, row]));
  for (const row of liveRows) {
    rowsByKey.set(`${row.weekEnding}|${row.club}`, row);
  }
  return [...rowsByKey.values()].sort((a, b) => a.weekEnding.localeCompare(b.weekEnding) || a.club.localeCompare(b.club));
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

  document.querySelector("#totalDD").previousElementSibling.textContent = isTargetView ? "Target DD" : "Total DD";
  document.querySelector("#totalPOS").previousElementSibling.textContent = isTargetView ? "Target POS" : "Total POS";
  document.querySelector("#totalRevenue").previousElementSibling.textContent = isTargetView ? "Target Revenue" : "Total Revenue";
  document.querySelector("#avgPOS").previousElementSibling.textContent = isTargetView ? "Target POS %" : "Avg POS %";

  setText("#totalDD", isTargetView || hasAnyRevenue ? formatMoney(totalDD) : "Not entered");
  setText("#totalPOS", isTargetView || hasAnyRevenue ? formatMoney(totalPOS) : "Not entered");
  setText("#totalRevenue", isTargetView || hasAnyRevenue ? formatMoney(totalRevenue) : "Not entered");
  setText("#avgPOS", isTargetView || hasAnyRevenue ? formatPercent(avgPOS) : "Not entered");
}

function metricRows() {
  if (state.view === "latest") return reportableRows();
  if (state.view === "overview") return rowsForWeeks(availableWeekEndings().slice(0, 4));
  if (state.view === "history") return rowsForWeeks(availableWeekEndings().slice(0, 12));
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
  const rowsByClub = visible(rowsForWeeks(availableWeekEndings().slice(0, 4))).reduce((groups, row) => {
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
        <span><span class="mini-label">DD Gap</span><strong class="mini-value ${gapClass(ddGap)}">${formatMoney(ddGap)}</strong></span>
      </div>
    </article>
    `;
  }).join("");
}

function renderLatest() {
  const latest = visible(reportableRows());
  const dynamicByClub = Object.fromEntries(data.dynamicTargets.map((row) => [row.club, row]));
  const container = document.querySelector("#latestGrid");

  container.innerHTML = latest.map((row) => {
    const target = dynamicByClub[row.club];
    const progress = Math.max(0, Math.min(100, row.targetPercent ? (row.posPercent / row.targetPercent) * 100 : 0));
    const cycle = rowPeriod(row);
    return `
      <article class="latest-card">
        <div class="card-head">
          <span class="club-name">${row.club}</span>
          <span class="status ${statusClass(row.status)}">${statusText(row.status)}</span>
        </div>
        <div class="mini-grid">
          <span><span class="mini-label">Revenue Period</span><strong class="mini-value">${cycle.period}</strong></span>
          <span><span class="mini-label">Reportable From</span><strong class="mini-value">${cycle.availableFromText}</strong></span>
          <span><span class="mini-label">DD Actual</span><strong class="mini-value">${formatMoney(row.ddActual)}</strong></span>
          <span><span class="mini-label">DD Gap</span><strong class="mini-value ${gapDisplayClass(row)}">${formatGap(row)}</strong></span>
          <span><span class="mini-label">POS Actual</span><strong class="mini-value">${formatMoney(row.posActual)}</strong></span>
          <span><span class="mini-label">POS %</span><strong class="mini-value">${formatPercent(row.posPercent)}</strong></span>
        </div>
        <div class="progress" aria-label="POS progress to target"><span style="width:${progress}%"></span></div>
        <p class="note">${hasRevenue(row) && target ? target.targetNote : "Revenue has not been entered for this reportable week yet."}</p>
      </article>
    `;
  }).join("");
}

function renderTargets() {
  const fixedByClub = Object.fromEntries(data.targets.map((row) => [row.club, row]));
  const rows = visible(data.dynamicTargets);
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
        <p class="note">${row.targetNote}</p>
      </article>
    `;
  }).join("");
}

function renderHistory() {
  const rows = visible(rowsForWeeks(availableWeekEndings().slice(0, 12))).sort((a, b) => b.weekEnding.localeCompare(a.weekEnding) || a.club.localeCompare(b.club));
  const body = document.querySelector("#historyBody");
  body.innerHTML = rows.map((row) => {
    const cycle = rowPeriod(row);
    return `
      <tr>
        <td>${cycle.period}</td>
        <td>${cycle.availableFromText}</td>
        <td>${row.club}</td>
        <td>${formatMoney(row.ddActual)}</td>
        <td class="${gapDisplayClass(row)}">${formatGap(row)}</td>
        <td>${formatMoney(row.posActual)}</td>
        <td>${formatPercent(row.posPercent)}</td>
        <td><span class="status ${statusClass(row.status)}">${statusText(row.status)}</span></td>
      </tr>
    `;
  }).join("");
}

function render() {
  renderMetrics();
  renderCycle();
  renderSummary();
  renderLatest();
  renderTargets();
  renderHistory();
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
}

function initControls() {
  const clubs = ["All Clubs", ...new Set([
    ...data.rolling.map((row) => row.club),
    ...data.targets.map((row) => row.club),
    ...data.dynamicTargets.map((row) => row.club)
  ])].filter(Boolean);
  clubFilter.innerHTML = clubs.map((club) => `<option>${club}</option>`).join("");

  const today = new Date();
  const sevenDaysAgo = addDays(today, -6);
  reportDateFrom.value = formatInputDate(sevenDaysAgo);
  reportDateTo.value = formatInputDate(today);
}

function renderSource() {
  const status = {
    live: "Live Hapana data",
    liveMetadata: "Hapana connected, workbook revenue",
    fallback: "Workbook fallback",
    workbook: "Workbook data"
  }[state.connection];

  setText("#connectionStatus", status);
  setText("#sourceName", data.source);
  setText("#updatedAt", `Prepared ${data.updated} | ${APP_VERSION}`);
}

clubFilter.addEventListener("change", (event) => {
  state.club = event.target.value;
  render();
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

reportDownloadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const params = new URLSearchParams({
    location: reportLocation.value,
    date_from: toHapanaDate(reportDateFrom.value),
    date_to: toHapanaDate(reportDateTo.value)
  });
  window.open(`/api/core-report?${params.toString()}`, "_blank", "noopener");
});

async function init() {
  await loadLiveData();
  initControls();
  renderSource();
  render();
}

init();
