const GRAPHS_APP_VERSION = "revenue-graphs-full-ytd-v4-2026-09-24";
const CLUB_ORDER = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];
const PRODUCTION_REVENUE_ENDPOINT = "https://ufcgym-dashboard-june2026.vercel.app/api/hapana";

let data = window.TRACKER_DATA || { rolling: [], source: "Workbook data", updated: null };

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0
});
const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short"
});

const state = {
  clubs: ["All Clubs"],
  displayMode: "weekly",
  connection: "workbook"
};

const clubFilter = document.querySelector("#clubFilter");
const displayMode = document.querySelector("#displayMode");

async function init() {
  await loadLiveData();
  initControls();
  render();
  window.dashboardAuth?.ready?.then(logGraphView);
}

async function loadLiveData() {
  try {
    const localPreview = window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "file:";
    const endpoint = localPreview ? PRODUCTION_REVENUE_ENDPOINT : "/api/hapana";
    const response = await fetch(endpoint, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Revenue API returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.rolling)) throw new Error("Revenue API returned invalid rolling rows");
    data = {
      ...data,
      ...payload,
      rolling: payload.rolling
    };
    state.connection = payload.rolling.length ? "live" : "empty";
  } catch (error) {
    console.warn("Revenue graph data could not load.", error);
    state.connection = "fallback";
  }
}

function initControls() {
  const clubs = ["All Clubs", ...sortedClubs()];
  clubFilter.multiple = true;
  clubFilter.size = Math.min(5, clubs.length);
  clubFilter.innerHTML = clubs.map((club) =>
    `<option value="${escapeHtml(club)}"${club === "All Clubs" ? " selected" : ""}>${escapeHtml(club)}</option>`
  ).join("");
  displayMode.value = state.displayMode;
}

function sortedClubs() {
  const clubs = [...new Set((data.rolling || []).map((row) => row.club).filter(Boolean))];
  return clubs.sort((a, b) => {
    const ai = CLUB_ORDER.indexOf(a);
    const bi = CLUB_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
}

function syncClubSelection() {
  const values = [...clubFilter.selectedOptions].map((option) => option.value);
  state.clubs = !values.length || values.includes("All Clubs") ? ["All Clubs"] : values;
  [...clubFilter.options].forEach((option) => {
    option.selected = state.clubs.includes(option.value);
  });
}

function isAllClubsSelected() {
  return state.clubs.includes("All Clubs");
}

function selectedClubNames() {
  return isAllClubsSelected() ? sortedClubs() : state.clubs;
}

function ytdRows() {
  const latest = latestWeekDate();
  if (!latest) return [];
  const year = latest.getFullYear();
  return (data.rolling || [])
    .filter((row) => {
      const date = parseDate(row.weekEnding);
      return date && date.getFullYear() === year && hasRevenue(row);
    })
    .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding) || String(a.club).localeCompare(String(b.club)));
}

function latestWeekDate() {
  const dates = (data.rolling || [])
    .filter(hasRevenue)
    .map((row) => parseDate(row.weekEnding))
    .filter(Boolean)
    .sort((a, b) => b - a);
  return dates[0] || null;
}

function visibleRows() {
  const clubs = new Set(selectedClubNames());
  return ytdRows().filter((row) => clubs.has(row.club));
}

function render() {
  renderSource();
  renderMetrics();
  renderPeriod();
  renderGraphs();
}

function renderSource() {
  const statuses = {
    live: "Live Hapana data",
    empty: "No stored revenue",
    fallback: "Workbook fallback",
    workbook: "Workbook data"
  };
  setText("#connectionStatus", statuses[state.connection] || "Loading");
  setText("#sourceName", data.source || "Hapana Core Net Revenue Detail");
  setText("#updatedAt", data.updated ? `Prepared ${data.updated} | ${GRAPHS_APP_VERSION}` : GRAPHS_APP_VERSION);
}

function renderMetrics() {
  const rows = visibleRows();
  const totalDD = rows.reduce((sum, row) => sum + (row.ddActual || 0), 0);
  const totalPOS = rows.reduce((sum, row) => sum + (row.posActual || 0), 0);
  setText("#ytdDD", formatMoney(totalDD));
  setText("#ytdPOS", formatMoney(totalPOS));
  setText("#ytdRevenue", formatMoney(totalDD + totalPOS));
  setText("#ytdPOSPercent", totalDD ? `${number.format((totalPOS / totalDD) * 100)}%` : "0%");
}

function renderPeriod() {
  const latest = latestWeekDate();
  const earliest = ytdRows()
    .map(rowStartDate)
    .filter(Boolean)
    .sort((a, b) => a - b)[0];
  if (!latest) {
    setText("#ytdPeriod", "No revenue data available");
    setText("#latestWeek", "No stored week");
    return;
  }
  const startLabel = earliest ? dateFormat.format(earliest) : "1 Jan";
  setText("#ytdPeriod", `${startLabel} to ${dateFormat.format(latest)} ${latest.getFullYear()}`);
  setText("#latestWeek", `${dateFormat.format(latest)} ${latest.getFullYear()}`);
}

function renderGraphs() {
  const ytdContainer = document.querySelector("#ytdGraphGrid");
  const yoyContainer = document.querySelector("#yoyGraphGrid");
  const rows = ytdRows();
  const clubs = selectedClubNames();

  if (!rows.length) {
    const empty = `<article class="graph-card"><p class="trend-empty">No YTD revenue rows are available yet.</p></article>`;
    ytdContainer.innerHTML = empty;
    yoyContainer.innerHTML = empty;
    return;
  }

  ytdContainer.innerHTML = clubs
    .map((club) => renderClubGraph(club, rows.filter((row) => row.club === club), "ytd"))
    .join("");
  yoyContainer.innerHTML = clubs
    .map((club) => renderClubGraph(club, rows.filter((row) => row.club === club), "yoy"))
    .join("");
}

function renderClubGraph(club, rows, graphType) {
  const isYoy = graphType === "yoy";
  if (!rows.length) {
    return `
      <article class="graph-card">
        <div class="trend-head">
          <h3>${escapeHtml(club)}</h3>
          <p>No YTD rows</p>
        </div>
        <p class="trend-empty">No stored DD or POS revenue for this club in the selected year.</p>
      </article>
    `;
  }

  const weeklyRows = fillMissingWeeks(rows);
  const isCumulative = state.displayMode === "cumulative";
  const comparison = isYoy ? yoyRows(club, weeklyRows) : null;
  const chartRows = isCumulative
    ? (isYoy ? cumulativeYoyRows(comparison.rows) : cumulativeRows(weeklyRows))
    : (isYoy ? comparison.rows : weeklyRows);
  const ddTotal = rows.reduce((sum, row) => sum + (row.ddActual || 0), 0);
  const posTotal = rows.reduce((sum, row) => sum + (row.posActual || 0), 0);
  const currentYear = parseDate(rows[rows.length - 1].weekEnding).getFullYear();
  const series = isYoy
    ? [
        { key: "ddActual", label: `${currentYear} DD`, color: "#17202a" },
        { key: "priorDD", label: `${currentYear - 1} DD`, color: "#6b7280", dash: "10 7" },
        { key: "posActual", label: `${currentYear} POS`, color: "#17834f" },
        { key: "priorPOS", label: `${currentYear - 1} POS`, color: "#73b892", dash: "10 7" }
      ]
    : [
        { key: "ddActual", label: "DD", color: "#17202a" },
        { key: "posActual", label: "POS", color: "#17834f" }
      ];
  const chart = lineChart({
    rows: chartRows,
    series,
    title: `${club} ${isYoy ? "year-on-year" : "YTD"} ${isCumulative ? "cumulative" : "weekly"} DD and POS`
  });

  return `
    <article class="graph-card">
      <div class="trend-head">
        <h3>${escapeHtml(club)}</h3>
        <p>${formatMoney(ddTotal)} DD | ${formatMoney(posTotal)} POS | ${ddTotal ? number.format((posTotal / ddTotal) * 100) : "0"}% POS</p>
      </div>
      <div class="trend-chart">${chart}</div>
      ${isYoy && !comparison.hasPriorData ? `
        <p class="trend-notice">${currentYear - 1} revenue history is not stored yet. The dashed comparison lines will appear after the Hapana history is backfilled.</p>
      ` : ""}
    </article>
  `;
}

function fillMissingWeeks(rows) {
  const byWeek = new Map(rows.map((row) => [row.weekEnding, row]));
  const weeks = [...byWeek.keys()].sort();
  return weeks.map((weekEnding) => ({
    weekEnding,
    ddActual: byWeek.get(weekEnding)?.ddActual || 0,
    posActual: byWeek.get(weekEnding)?.posActual || 0
  }));
}

function cumulativeRows(rows) {
  let ddActual = 0;
  let posActual = 0;
  return rows.map((row) => {
    ddActual += row.ddActual || 0;
    posActual += row.posActual || 0;
    return { ...row, ddActual, posActual };
  });
}

function yoyRows(club, currentRows) {
  const allClubRows = (data.rolling || []).filter((row) => row.club === club && hasRevenue(row));
  const byWeek = new Map(allClubRows.map((row) => [row.weekEnding, row]));
  let hasPriorData = false;
  const rows = currentRows.map((row) => {
    const priorWeek = shiftIsoDate(row.weekEnding, -364);
    const prior = byWeek.get(priorWeek);
    if (prior) hasPriorData = true;
    return {
      ...row,
      priorWeek,
      priorDD: prior?.ddActual ?? null,
      priorPOS: prior?.posActual ?? null
    };
  });
  return { rows, hasPriorData };
}

function cumulativeYoyRows(rows) {
  let ddActual = 0;
  let posActual = 0;
  let priorDD = 0;
  let priorPOS = 0;
  return rows.map((row) => {
    ddActual += row.ddActual || 0;
    posActual += row.posActual || 0;
    if (row.priorDD !== null) priorDD += row.priorDD || 0;
    if (row.priorPOS !== null) priorPOS += row.priorPOS || 0;
    return {
      ...row,
      ddActual,
      posActual,
      priorDD: row.priorDD === null && priorDD === 0 ? null : priorDD,
      priorPOS: row.priorPOS === null && priorPOS === 0 ? null : priorPOS
    };
  });
}

function lineChart({ rows, series, title }) {
  const width = 980;
  const height = 320;
  const pad = { top: 20, right: 34, bottom: 54, left: 84 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(1, ...rows.flatMap((row) => series.map((item) => numericValue(row[item.key]))));
  const yStep = yTickStep(maxValue);
  const yMax = Math.max(yStep, Math.ceil(maxValue / yStep) * yStep);
  const x = (index) => pad.left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const y = (value) => pad.top + plotHeight - (value / yMax) * plotHeight;
  const ticks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, index) => index * yStep);
  const labelIndexes = xLabelIndexes(rows.length);

  const grid = ticks.map((tick) => `
    <line class="trend-grid" x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}"></line>
    <text class="trend-label" x="${pad.left - 12}" y="${y(tick) + 4}" text-anchor="end">${formatMoney(tick)}</text>
  `).join("");

  const labels = labelIndexes.map((index) => `
    <text class="trend-label" x="${x(index)}" y="${height - 20}" text-anchor="middle">${dateFormat.format(parseDate(rows[index].weekEnding))}</text>
  `).join("");

  const paths = series.map((item) => {
    const points = rows
      .map((row, index) => ({ row, index, value: row[item.key] }))
      .filter((point) => point.value !== null && point.value !== undefined && point.value !== "");
    if (!points.length) return "";
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.index)},${y(numericValue(point.value))}`).join(" ");
    const dots = points.map(({ row, index, value }) => `
      <circle class="trend-dot" cx="${x(index)}" cy="${y(numericValue(value))}" r="3.5" fill="${item.color}">
        <title>${escapeHtml(item.label)} ${dateFormat.format(parseDate(item.key.startsWith("prior") ? row.priorWeek : row.weekEnding))}: ${formatMoney(value)}</title>
      </circle>
    `).join("");
    const dash = item.dash ? ` stroke-dasharray="${item.dash}"` : "";
    return `<path class="trend-line" d="${path}" stroke="${item.color}"${dash}></path>${dots}`;
  }).join("");

  const legend = series.map((item) => {
    const swatch = item.dash
      ? `repeating-linear-gradient(90deg, ${item.color} 0 6px, transparent 6px 10px)`
      : item.color;
    return `<span><i class="trend-swatch" style="background:${swatch}"></i>${escapeHtml(item.label)}</span>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
      ${grid}
      <line class="trend-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
      <line class="trend-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
      ${labels}
      ${paths}
    </svg>
    <div class="trend-legend">${legend}</div>
  `;
}

function xLabelIndexes(length) {
  if (length <= 6) return Array.from({ length }, (_, index) => index);
  const last = length - 1;
  return [...new Set([0, Math.round(last * 0.25), Math.round(last * 0.5), Math.round(last * 0.75), last])];
}

function yTickStep(maxValue) {
  if (maxValue <= 5000) return 1000;
  if (maxValue <= 25000) return 5000;
  if (maxValue <= 100000) return 10000;
  if (maxValue <= 250000) return 25000;
  return 50000;
}

function hasRevenue(row) {
  return hasValue(row.ddActual) || hasValue(row.posActual);
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function numericValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shiftIsoDate(value, days) {
  const date = parseDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function rowStartDate(row) {
  const parts = String(row?.dateFrom || "").split("/").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return parseDate(row?.weekEnding);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMoney(value) {
  return money.format(value || 0);
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
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

clubFilter.addEventListener("change", () => {
  syncClubSelection();
  render();
  logGraphView();
});

displayMode.addEventListener("change", () => {
  state.displayMode = displayMode.value;
  render();
  logGraphView();
});

function logGraphView() {
  window.dashboardAuth?.logView?.({
    page: "Graphs",
    view: state.displayMode,
    club: isAllClubsSelected() ? "All Clubs" : state.clubs.join(", ")
  });
}

init();
