const MEMBER_APP_VERSION = "member-dashboard-movement-windows-v13-2026-06-09";
const REFRESH_CLUBS = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];

const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short"
});

const state = {
  club: "All Clubs",
  view: "overview",
  data: {
    source: "Hapana Core Membership Detail",
    updated: null,
    clubs: [],
    totals: { activeMembers: 0, standardActiveMembers: 0, fitnessPassportMembers: 0, cancellations: 0, suspensions: 0, newMemberships: 0, movement: {}, dailyActive: [] },
    failures: []
  },
  connection: "loading"
};

const clubFilter = document.querySelector("#clubFilter");
const refreshForm = document.querySelector("#memberRefreshForm");
const memberDateFrom = document.querySelector("#memberDateFrom");
const memberDateTo = document.querySelector("#memberDateTo");
const memberRefreshStatus = document.querySelector("#memberRefreshStatus");

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
  const [day, month, year] = String(value || "").split("/").map(Number);
  return new Date(year, month - 1, day);
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

function visibleClubs() {
  return state.club === "All Clubs"
    ? state.data.clubs
    : state.data.clubs.filter((row) => row.club === state.club);
}

function visibleTotals() {
  const clubs = visibleClubs();
  if (state.club === "All Clubs") return state.data.totals;

  const row = clubs[0] || {};
  return {
    activeMembers: row.activeMembers || 0,
    standardActiveMembers: standardActive(row),
    fitnessPassportMembers: row.fitnessPassportMembers || 0,
    cancellations: row.cancellations || 0,
    suspensions: row.suspensions || 0,
    newMemberships: row.newMemberships || 0,
    movement: row.movement || {},
    dailyActive: row.dailyActive || []
  };
}

async function loadMemberData() {
  try {
    const response = await fetch("/api/member-metrics?stored=1", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Member metrics returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.clubs)) throw new Error("Member metrics returned invalid club rows");
    state.data = {
      ...state.data,
      ...payload,
      totals: payload.totals || state.data.totals
    };
    state.connection = payload.clubs.length ? "live" : "empty";
  } catch (error) {
    console.warn("Member metrics could not load.", error);
    state.connection = "error";
  }
}

function initControls() {
  const clubs = ["All Clubs", ...state.data.clubs.map((row) => row.club)].filter(Boolean);
  clubFilter.innerHTML = clubs.map((club) => `<option>${escapeHtml(club)}</option>`).join("");

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  memberDateFrom.value = formatInputDate(start);
  memberDateTo.value = formatInputDate(today);
}

function renderSource() {
  const statuses = {
    loading: "Loading",
    live: "Live Hapana data",
    empty: "No member data stored",
    error: "Member data unavailable"
  };
  setText("#connectionStatus", statuses[state.connection]);
  setText("#sourceName", state.data.source || "Hapana Core Membership Detail");
  setText("#updatedAt", state.data.updated
    ? `Prepared ${state.data.updated} | ${MEMBER_APP_VERSION}`
    : MEMBER_APP_VERSION);
}

function renderMetrics() {
  const totals = visibleTotals();
  setText("#activeMembers", number.format(totals.activeMembers || 0));
  setText("#standardActiveMembers", number.format(standardActive(totals)));
  setText("#fitnessPassportMembers", number.format(totals.fitnessPassportMembers || 0));
  setText("#cancellations", number.format(totals.cancellations || 0));
  setText("#suspensions", number.format(totals.suspensions || 0));
}

function renderMovement() {
  const movement = visibleTotals().movement || {};
  const previous = movement.previousMonth || {};
  const current = movement.currentMonthToDate || {};

  setText("#previousMovementLabel", previous.label ? `Previous Month (${previous.label})` : "Previous Month");
  setText("#currentMovementLabel", current.label ? `Current MTD (${current.label})` : "Current MTD");
  setText("#previousNewSales", number.format(previous.newSales || 0));
  setText("#previousCancellations", number.format(previous.cancellations || 0));
  setText("#previousSuspensions", number.format(previous.suspensions || 0));
  setText("#currentNewSales", number.format(current.newSales || 0));
  setText("#currentCancellations", number.format(current.cancellations || 0));
  setText("#currentSuspensions", number.format(current.suspensions || 0));
}

function renderPeriod() {
  const { dateFrom, dateTo } = state.data;
  if (dateFrom && dateTo) {
    setText("#memberPeriod", `${formatDate(parseHapanaDate(dateFrom))} to ${formatDate(parseHapanaDate(dateTo))}`);
  } else {
    setText("#memberPeriod", "Run /api/member-metrics to load the first month");
  }
  setText("#memberSource", state.data.failures?.length
    ? `${state.data.failures.length} club issue(s) need checking`
    : state.data.clubs.some((row) => row.fallback)
      ? "Account list active counts from Core Hapana"
      : "Membership Detail CSV from Core Hapana");
}

function renderSummary() {
  const container = document.querySelector("#memberSummaryGrid");
  const rows = visibleClubs();

  if (!rows.length) {
    container.innerHTML = `<article class="club-card"><p class="note">No stored member metrics yet. Use Update Members after deploying.</p></article>`;
    return;
  }

  container.innerHTML = rows.map((row) => `
    <article class="club-card">
      <div class="card-head">
        <span class="club-name">${escapeHtml(row.club)}</span>
        <span class="status ${row.warning || row.fallback ? "amber" : "green"}">${row.fallback ? "active only" : "members"}</span>
      </div>
      <div class="mini-grid">
        <span><span class="mini-label">Total Active</span><strong class="mini-value">${number.format(row.activeMembers || 0)}</strong></span>
        <span><span class="mini-label">Standard</span><strong class="mini-value">${number.format(standardActive(row))}</strong></span>
        <span><span class="mini-label">Fitness Passport</span><strong class="mini-value">${number.format(row.fitnessPassportMembers || 0)}</strong></span>
        <span><span class="mini-label">New</span><strong class="mini-value">${number.format(row.newMemberships || 0)}</strong></span>
        <span><span class="mini-label">Cancelled</span><strong class="mini-value negative">${number.format(row.cancellations || 0)}</strong></span>
        <span><span class="mini-label">Suspended</span><strong class="mini-value">${number.format(row.suspensions || 0)}</strong></span>
      </div>
      ${row.warning ? `<p class="note">${escapeHtml(row.warning)}</p>` : ""}
    </article>
  `).join("");
}

function renderDailyChart() {
  const container = document.querySelector("#dailyActiveTrend");
  const totals = visibleTotals();
  const points = totals.dailyActive || [];
  setText("#dailyChartNote", state.club === "All Clubs" ? "All clubs combined." : state.club);

  if (!points.length) {
    container.innerHTML = `<p class="trend-empty">No daily active data has been stored yet.</p>`;
    return;
  }

  const width = 980;
  const height = 320;
  const pad = { top: 22, right: 28, bottom: 54, left: 72 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(1, ...points.map((point) => point.active || 0));
  const yStep = Math.max(10, Math.ceil(maxValue / 5 / 10) * 10);
  const yMax = Math.max(yStep, Math.ceil(maxValue / yStep) * yStep);
  const x = (index) => pad.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => pad.top + plotHeight - (value / yMax) * plotHeight;
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, index) => index * yStep);

  const grid = yTicks.map((tick) => `
    <line class="trend-grid" x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}"></line>
    <text class="trend-label" x="${pad.left - 12}" y="${y(tick) + 4}" text-anchor="end">${number.format(tick)}</text>
  `).join("");

  const xLabels = points.map((point, index) => {
    if (index % Math.ceil(points.length / 8) !== 0 && index !== points.length - 1) return "";
    return `<text class="trend-label" x="${x(index)}" y="${height - 20}" text-anchor="middle">${formatDate(parseDate(point.date)).replace("Thu, ", "")}</text>`;
  }).join("");

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)},${y(point.active || 0)}`).join(" ");
  const dots = points.map((point, index) => `
    <circle class="trend-dot" cx="${x(index)}" cy="${y(point.active || 0)}" r="3.8" fill="#c8112e">
      <title>${formatDate(parseDate(point.date))}: ${number.format(point.active || 0)} active</title>
    </circle>
  `).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily active member count line graph">
      ${grid}
      <line class="trend-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
      <line class="trend-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
      ${xLabels}
      <path class="trend-line" d="${path}" stroke="#c8112e"></path>
      ${dots}
    </svg>
  `;
}

function renderDetail() {
  const body = document.querySelector("#memberDetailBody");
  body.innerHTML = visibleClubs().map((row) => `
    <tr>
      <td>${escapeHtml(row.club)}</td>
      <td>${number.format(row.activeMembers || 0)}</td>
      <td>${number.format(standardActive(row))}</td>
      <td>${number.format(row.fitnessPassportMembers || 0)}</td>
      <td>${number.format(row.cancellations || 0)}</td>
      <td>${number.format(row.suspensions || 0)}</td>
      <td>${number.format(row.newMemberships || 0)}</td>
      <td>${row.fallback ? "Fallback" : number.format(row.rowCount || 0)}</td>
    </tr>
  `).join("");
}

function render() {
  renderSource();
  renderMetrics();
  renderMovement();
  renderPeriod();
  renderSummary();
  renderDailyChart();
  renderDetail();
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${view}View`);
  });
}

clubFilter.addEventListener("change", (event) => {
  state.club = event.target.value;
  render();
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

refreshForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshMemberMetrics();
});

async function refreshMemberMetrics() {
  const button = refreshForm.querySelector("button");
  button.disabled = true;
  const originalText = button.textContent;

  try {
    memberRefreshStatus.textContent = "Updating all clubs...";
    const params = new URLSearchParams({
      all: "1",
      date_from: toHapanaDate(memberDateFrom.value),
      date_to: toHapanaDate(memberDateTo.value),
      source: "core"
    });
    const response = await fetch(`/api/member-metrics?${params.toString()}`, {
      headers: { "Accept": "application/json" }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) {
      throw new Error(errorText(body.error || body || `HTTP ${response.status}`));
    }
    const failures = Array.isArray(body.failures)
      ? body.failures.map((item) => `${item.club || "Club"}: ${errorText(item.error)}`)
      : [];

    memberRefreshStatus.textContent = "Member data updated. Refreshing dashboard...";
    await loadMemberData();
    initControls();
    render();
    memberRefreshStatus.textContent = failures.length
      ? `Finished with issues: ${failures.join(" | ")}`
      : "Member data updated.";
  } catch (error) {
    memberRefreshStatus.textContent = errorText(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function standardActive(row) {
  return row.standardActiveMembers ?? Math.max(0, (row.activeMembers || 0) - (row.fitnessPassportMembers || 0));
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

async function init() {
  await loadMemberData();
  initControls();
  render();
}

init();
