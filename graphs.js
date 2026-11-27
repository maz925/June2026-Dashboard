const GRAPHS_APP_VERSION = "revenue-graphs-purple-palette-v8-2026-09-25";
const CLUB_ORDER = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];
const CLUB_YOY_START_DATES = {
  Woolooware: "2025-06-01"
};

let data = { rolling: [], source: "Workbook data", updated: null };

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
  try {
    window.DashboardUI?.showStatus("Loading revenue graphs…");
    await window.dashboardAuth?.ready;
    await loadLiveData();
    initControls();
    window.DashboardUI?.installClubFilter(clubFilter);
    syncClubSelection();
    render();
    document.body.classList.remove("dashboard-pending");
    window.DashboardUI?.hideStatus();
    logGraphView();
  } catch (error) {
    document.body.classList.remove("dashboard-pending");
    window.DashboardUI?.showStatus(error.message || "Revenue graphs could not load.", "error");
  }
}

async function loadLiveData() {
  const fetchImpl = window.DashboardUI?.fetch || fetch;
  try {
    const workbookResponse = await fetchImpl("/api/workbook", { headers: { "Accept": "application/json" } });
    if (workbookResponse.ok) {
      const workbook = await workbookResponse.json();
      if (Array.isArray(workbook.rolling)) data = { ...data, ...workbook };
    }
  } catch (error) {
    console.warn("Workbook fallback could not load.", error);
  }
  try {
    const response = await fetchImpl("/api/hapana", { headers: { "Accept": "application/json" } });
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
  renderComparisonTable();
  const notes = window.DashboardLogic.suspiciousWeeks(ytdRows());
  window.DashboardUI?.renderAttention(notes.length ? [{
    tone: "watch",
    text: `${notes.length} stored weeks are far below that club's usual direct debit or fall before Woolooware opened. The charts keep the stored numbers and list the reason underneath.`
  }] : []);
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
  window.DashboardUI?.paintFreshness(data.updated, GRAPHS_APP_VERSION);
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
  const year = latest.getFullYear();
  setText("#ytdDDLabel", `Calendar ${year} DD`);
  setText("#ytdPOSLabel", `Calendar ${year} POS`);
  setText("#ytdRevenueLabel", `Calendar ${year} revenue`);
  setText("#ytdPOSPercentLabel", `Calendar ${year} POS %`);
  setText("#ytdPeriod", `Calendar year: ${startLabel.replace(/Sept/g, "Sep")} to ${dateFormat.format(latest).replace(/Sept/g, "Sep")} ${year}`);
  setText("#latestWeek", `${dateFormat.format(latest).replace(/Sept/g, "Sep")} ${year}`);
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
  const summaryRows = isYoy ? comparison.rows : rows;
  const ddTotal = summaryRows.reduce((sum, row) => sum + (row.ddActual || 0), 0);
  const posTotal = summaryRows.reduce((sum, row) => sum + (row.posActual || 0), 0);
  const currentYear = parseDate(rows[rows.length - 1].weekEnding).getFullYear();
  const series = isYoy
    ? [
        { key: "ddActual", label: `${currentYear} DD`, color: "#5b21b6" },
        { key: "posActual", label: `${currentYear} POS`, color: "#a21caf" },
        { key: "priorDD", label: `${currentYear - 1} DD`, color: "#d97706", dash: "10 7" },
        { key: "priorPOS", label: `${currentYear - 1} POS`, color: "#0f766e", dash: "10 7" }
      ]
    : [
        { key: "ddActual", label: "DD", color: "#4c1d95" },
        { key: "posActual", label: "POS", color: "#a855f7" }
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
      ${gapNotes(rows)}
      ${isYoy && comparison.startDate ? `
        <p class="trend-comparison-note">YoY comparison begins with the June 2025 opening period.</p>
      ` : ""}
      ${isYoy && !comparison.hasPriorData ? `
        <p class="trend-notice">${currentYear - 1} revenue history is not stored yet. The dashed comparison lines will appear after the Hapana history is backfilled.</p>
      ` : ""}
    </article>
  `;
}

function renderComparisonTable() {
  const currentRows = ytdRows();
  const latest = latestWeekDate();
  const currentYear = latest?.getFullYear();
  const priorYear = currentYear ? currentYear - 1 : null;
  const head = document.querySelector("#comparisonHead");
  const body = document.querySelector("#comparisonBody");

  head.innerHTML = `
    <tr>
      <th>Club</th>
      <th>${currentYear || "Current"} matched DD</th>
      <th>${priorYear || "Prior"} matched DD</th>
      <th>DD change</th>
      <th>${currentYear || "Current"} matched POS</th>
      <th>${priorYear || "Prior"} matched POS</th>
      <th>POS change</th>
      <th>${currentYear || "Current"} matched total</th>
      <th>${priorYear || "Prior"} matched total</th>
      <th>Total change</th>
    </tr>
  `;

  if (!currentRows.length) {
    body.innerHTML = `<tr><td colspan="10" class="muted-value">No revenue data is available for comparison.</td></tr>`;
    return;
  }

  const comparisons = selectedClubNames().map((club) => comparisonForClub(club, currentRows));
  const rows = comparisons.map((comparison) => comparisonRowHtml(comparison));
  if (comparisons.length > 1) {
    rows.push(comparisonRowHtml(sumComparisons(
      comparisons,
      isAllClubsSelected() ? "All Clubs" : "Selected Clubs"
    ), true));
  }
  body.innerHTML = rows.join("");
  setText(
    "#comparisonPeriod",
    `The cards above are calendar ${currentYear} (every stored week from 1 Jan). This table is only the weeks with a ${priorYear} match. Woolooware starts in June 2025, so its January–May ${currentYear} direct debit is in the calendar total and not in the All Clubs row here. Declines are in red.`
  );
}

function comparisonForClub(club, allCurrentRows) {
  const currentRows = fillMissingWeeks(allCurrentRows.filter((row) => row.club === club));
  const matchedRows = yoyRows(club, currentRows).rows;
  return matchedRows.reduce((totals, row) => ({
    ...totals,
    currentDD: totals.currentDD + numericValue(row.ddActual),
    priorDD: totals.priorDD + numericValue(row.priorDD),
    currentPOS: totals.currentPOS + numericValue(row.posActual),
    priorPOS: totals.priorPOS + numericValue(row.priorPOS),
    hasPrior: totals.hasPrior || row.priorDD !== null || row.priorPOS !== null
  }), {
    club,
    currentDD: 0,
    priorDD: 0,
    currentPOS: 0,
    priorPOS: 0,
    hasPrior: false
  });
}

function sumComparisons(comparisons, club) {
  return comparisons.reduce((totals, row) => ({
    ...totals,
    currentDD: totals.currentDD + row.currentDD,
    priorDD: totals.priorDD + row.priorDD,
    currentPOS: totals.currentPOS + row.currentPOS,
    priorPOS: totals.priorPOS + row.priorPOS,
    hasPrior: totals.hasPrior || row.hasPrior
  }), {
    club,
    currentDD: 0,
    priorDD: 0,
    currentPOS: 0,
    priorPOS: 0,
    hasPrior: false
  });
}

function comparisonRowHtml(row, total = false) {
  const currentTotal = row.currentDD + row.currentPOS;
  const priorTotal = row.priorDD + row.priorPOS;
  return `
    <tr${total ? ' class="comparison-total"' : ""}>
      <td><strong>${escapeHtml(row.club)}</strong></td>
      <td>${formatMoney(row.currentDD)}</td>
      <td>${row.hasPrior ? formatMoney(row.priorDD) : "-"}</td>
      ${changeCell(row.currentDD, row.priorDD, row.hasPrior)}
      <td>${formatMoney(row.currentPOS)}</td>
      <td>${row.hasPrior ? formatMoney(row.priorPOS) : "-"}</td>
      ${changeCell(row.currentPOS, row.priorPOS, row.hasPrior)}
      <td>${formatMoney(currentTotal)}</td>
      <td>${row.hasPrior ? formatMoney(priorTotal) : "-"}</td>
      ${changeCell(currentTotal, priorTotal, row.hasPrior)}
    </tr>
  `;
}

function changeCell(current, prior, hasPrior) {
  if (!hasPrior || !prior) return `<td class="muted-value">-</td>`;
  const change = ((current - prior) / Math.abs(prior)) * 100;
  const className = change > 0 ? "positive" : change < 0 ? "negative" : "muted-value";
  const sign = change > 0 ? "+" : "";
  return `<td class="${className}">${sign}${number.format(change)}%</td>`;
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
  const startDate = CLUB_YOY_START_DATES[club] || null;
  let hasPriorData = false;
  const rows = currentRows
    .map((row) => {
      const priorWeek = shiftIsoDate(row.weekEnding, -364);
      const prior = byWeek.get(priorWeek);
      return {
        ...row,
        priorWeek,
        priorDD: prior?.ddActual ?? null,
        priorPOS: prior?.posActual ?? null
      };
    })
    .filter((row) => !startDate || row.priorWeek >= startDate);
  hasPriorData = rows.some((row) => row.priorDD !== null || row.priorPOS !== null);
  return { rows, hasPriorData, startDate };
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
  const posSeries = series.filter((item) => /pos/i.test(item.key));
  const ddSeries = series.filter((item) => !posSeries.includes(item));
  const split = Boolean(posSeries.length && ddSeries.length);
  const width = 980;
  const height = 360;
  const pad = { top: 20, right: split ? 84 : 28, bottom: 68, left: 84 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxOf = (items) => Math.max(1, ...rows.flatMap((row) => items.map((item) => numericValue(row[item.key]))));
  const leftMaxValue = maxOf(split ? ddSeries : series);
  const rightMaxValue = split ? maxOf(posSeries) : leftMaxValue;
  const leftStep = yTickStep(leftMaxValue);
  const rightStep = yTickStep(rightMaxValue);
  const leftMax = Math.max(leftStep, Math.ceil(leftMaxValue / leftStep) * leftStep);
  const rightMax = Math.max(rightStep, Math.ceil(rightMaxValue / rightStep) * rightStep);
  const x = (index) => pad.left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const yFor = (value, max) => pad.top + plotHeight - (value / max) * plotHeight;
  const leftTicks = Array.from({ length: Math.floor(leftMax / leftStep) + 1 }, (_, index) => index * leftStep);
  const rightTicks = Array.from({ length: Math.floor(rightMax / rightStep) + 1 }, (_, index) => index * rightStep);
  const labelIndexes = xLabelIndexes(rows.length);

  const grid = leftTicks.map((tick) => `
    <line class="trend-grid" x1="${pad.left}" y1="${yFor(tick, leftMax)}" x2="${width - pad.right}" y2="${yFor(tick, leftMax)}"></line>
    <text class="trend-label" x="${pad.left - 12}" y="${yFor(tick, leftMax) + 4}" text-anchor="end">${formatMoney(tick)}</text>
  `).join("") + (split ? rightTicks.map((tick) => `
    <text class="trend-label" x="${width - pad.right + 10}" y="${yFor(tick, rightMax) + 4}">${formatMoney(tick)}</text>
  `).join("") : "");

  const labels = labelIndexes.map((index) => `
    <text class="trend-label" x="${x(index)}" y="${height - 42}" text-anchor="end" transform="rotate(-40 ${x(index)} ${height - 42})">${dateFormat.format(parseDate(rows[index].weekEnding)).replace(/Sept/g, "Sep")}</text>
  `).join("");

  const paths = series.map((item) => {
    const max = split && /pos/i.test(item.key) ? rightMax : leftMax;
    const points = rows
      .map((row, index) => ({ row, index, value: row[item.key] }))
      .filter((point) => point.value !== null && point.value !== undefined && point.value !== "");
    if (!points.length) return "";
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.index)},${yFor(numericValue(point.value), max)}`).join(" ");
    const dots = points.map(({ row, index, value }) => {
      const week = item.key.startsWith("prior") ? row.priorWeek : row.weekEnding;
      const start = shiftIsoDate(week, -6);
      const tip = `${item.label}: ${dateFormat.format(parseDate(start)).replace(/Sept/g, "Sep")} to ${dateFormat.format(parseDate(week)).replace(/Sept/g, "Sep")}. ${formatMoney(value)}.`;
      return `
      <circle class="trend-dot" data-tip="${escapeHtml(tip)}" cx="${x(index)}" cy="${yFor(numericValue(value), max)}" r="3.8" fill="${item.color}">
        <title>${escapeHtml(tip)}</title>
      </circle>`;
    }).join("");
    const dash = item.dash ? ` stroke-dasharray="${item.dash}"` : "";
    return `<path class="trend-line" d="${path}" stroke="${item.color}"${dash}></path>${dots}`;
  }).join("");

  const legend = series.map((item) => {
    const swatch = item.dash
      ? `repeating-linear-gradient(90deg, ${item.color} 0 6px, transparent 6px 10px)`
      : item.color;
    const axis = split && /pos/i.test(item.key) ? " (right axis)" : split ? " (left axis)" : "";
    return `<span><i class="trend-swatch" style="background:${swatch}"></i>${escapeHtml(item.label)}${axis}</span>`;
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
  if (length <= 14) return Array.from({ length }, (_, index) => index);
  const step = Math.ceil(length / 12);
  const indexes = [];
  for (let index = 0; index < length; index += step) indexes.push(index);
  if (indexes[indexes.length - 1] !== length - 1) indexes.push(length - 1);
  return indexes;
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
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function gapNotes(rows) {
  const notes = window.DashboardLogic.suspiciousWeeks(rows);
  if (!notes.length) return "";
  return `<ul class="gap-notes">${notes.map((note) => `<li><strong>${escapeHtml(note.weekEnding)}</strong>: ${escapeHtml(note.reason)}</li>`).join("")}</ul>`;
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
