const MEMBER_APP_VERSION = "member-dashboard-mtd-v32-2026-10-23";
const REFRESH_CLUBS = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];
function memberApiUrl(query) {
  return `/api/member-metrics?${query}`;
}

function apiFetch(url, options) {
  return (window.DashboardUI?.fetch || fetch)(url, options);
}

const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short"
});

const state = {
  clubs: ["All Clubs"],
  view: "overview",
  data: {
    source: "Hapana Core Membership Detail",
    updated: null,
    clubs: [],
    totals: { activeMembers: 0, standardActiveMembers: 0, fitnessPassportMembers: 0, cancellations: 0, revenueCancellations: {}, revenueNewSales: {}, suspensions: 0, newMemberships: 0, newMembers: {}, movement: {}, cancellationForecast: {}, dailyActive: [] },
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
  return dateFormat.format(date).replace(/Sept/g, "Sep");
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
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function profileNote(row) {
  const packages = row.movement?.currentMonthToDate?.newSales || 0;
  const profiles = currentMonthNewMemberships(row);
  if (packages <= profiles + 2) return "";
  return `<p class="note">${escapeHtml(row.club)} shows ${number.format(profiles)} new profiles and ${number.format(packages)} packages sold this month. New profiles use the member created date, so a package sold to someone who joined earlier is not counted as a new member.</p>`;
}

function renderAttentionPanel() {
  const rows = visibleClubs();
  const items = [];
  if (document.querySelector("#updatedAt .stale-warning")) {
    items.push({ tone: "bad", text: "Member data is more than 7 days old. The daily job refreshes one club at a time and only publishes when all four clubs succeed, so a failed Hapana export leaves the previous snapshot in place." });
  }
  const worst = [...rows].sort((a, b) => netMemberMovement(a) - netMemberMovement(b))[0];
  if (worst && netMemberMovement(worst) < 0) {
    items.push({ tone: "bad", text: `${worst.club} has the weakest NMM at ${formatSigned(netMemberMovement(worst))} (new profiles minus paid cancellations).` });
  }
  const cancels = [...rows].sort((a, b) => currentMonthCancellations(b) - currentMonthCancellations(a))[0];
  if (cancels && currentMonthCancellations(cancels) > 0) {
    items.push({ tone: "watch", text: `${cancels.club} has the most paid cancellations MTD (${number.format(currentMonthCancellations(cancels))}). Scheduled cancels for the whole month are a different count.` });
  }
  window.DashboardUI?.renderAttention(items);
  window.DashboardUI?.bindDefinitions(document);
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
  const rows = isAllClubsSelected()
    ? state.data.clubs
    : state.data.clubs.filter((row) => selectedClubNames().includes(row.club));
  const order = window.DashboardLogic.CLUB_ORDER;
  return [...rows].sort((a, b) => order.indexOf(a.club) - order.indexOf(b.club));
}

function visibleTotals() {
  const clubs = visibleClubs();
  if (isAllClubsSelected()) return state.data.totals;
  return aggregateClubTotals(clubs);
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

function aggregateClubTotals(clubs) {
  const totals = clubs.reduce((sum, row) => ({
    activeMembers: sum.activeMembers + (row.activeMembers || 0),
    standardActiveMembers: sum.standardActiveMembers + standardActive(row),
    fitnessPassportMembers: sum.fitnessPassportMembers + (row.fitnessPassportMembers || 0),
    cancellations: sum.cancellations + (row.cancellations || 0),
    revenueCancellations: aggregateNewMembers(sum.revenueCancellations, row.revenueCancellations || {}),
    revenueNewSales: aggregateNewMembers(sum.revenueNewSales, row.revenueNewSales || {}),
    suspensions: sum.suspensions + (row.suspensions || 0),
    newMemberships: sum.newMemberships + (row.newMemberships || 0),
    newMembers: aggregateNewMembers(sum.newMembers, row.newMembers || {}),
    movement: aggregateMovement(sum.movement, row.movement || {}),
    cancellationForecast: aggregateCancellationForecast(sum.cancellationForecast, row.cancellationForecast || {}),
    dailyActive: sumDailyActive(sum.dailyActive, row.dailyActive || [])
  }), {
    activeMembers: 0,
    standardActiveMembers: 0,
    fitnessPassportMembers: 0,
    cancellations: 0,
    revenueCancellations: {},
    revenueNewSales: {},
    suspensions: 0,
    newMemberships: 0,
    newMembers: {},
    movement: {},
    cancellationForecast: {},
    dailyActive: []
  });

  return {
    ...totals,
    movement: normaliseMovement(totals.movement),
    cancellationForecast: normaliseCancellationForecast(totals.cancellationForecast)
  };
}

function aggregateMovement(current, next) {
  return {
    previousMonth: addMovementWindow(current.previousMonth, next.previousMonth),
    currentMonthToDate: addMovementWindow(current.currentMonthToDate, next.currentMonthToDate)
  };
}

function addMovementWindow(current = {}, next = {}) {
  return {
    label: current.label || next.label || "",
    newSales: (current.newSales || 0) + (next.newSales || 0),
    standardNewSales: (current.standardNewSales || 0) + standardNewSales(next),
    fitnessPassportNewSales: (current.fitnessPassportNewSales || 0) + (next.fitnessPassportNewSales || 0),
    cancellations: (current.cancellations || 0) + (next.cancellations || 0),
    suspensions: (current.suspensions || 0) + (next.suspensions || 0)
  };
}

function normaliseMovement(movement) {
  return {
    previousMonth: movement.previousMonth || {},
    currentMonthToDate: movement.currentMonthToDate || {}
  };
}

function aggregateCancellationForecast(current, next) {
  return {
    currentMonth: addCancellationWindow(current.currentMonth, next.currentMonth),
    nextMonth: addCancellationWindow(current.nextMonth, next.nextMonth)
  };
}

function addCancellationWindow(current = {}, next = {}) {
  return {
    label: current.label || next.label || "",
    cancellations: (current.cancellations || 0) + (next.cancellations || 0)
  };
}

function normaliseCancellationForecast(forecast) {
  return {
    currentMonth: forecast.currentMonth || {},
    nextMonth: forecast.nextMonth || {}
  };
}

function sumDailyActive(current, next) {
  const byDate = new Map(current.map((point) => [point.date, point.active || 0]));
  for (const point of next) {
    byDate.set(point.date, (byDate.get(point.date) || 0) + (point.active || 0));
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, active]) => ({ date, active }));
}

async function loadMemberData() {
  try {
    const response = await apiFetch(memberApiUrl(`stored=1&_=${Date.now()}`), { headers: { "Accept": "application/json" } });
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
  const clubs = window.DashboardLogic.orderClubs(["All Clubs", ...state.data.clubs.map((row) => row.club)].filter(Boolean));
  clubFilter.multiple = true;
  clubFilter.size = Math.min(5, clubs.length);
  clubFilter.innerHTML = clubs.map((club) => `<option value="${escapeHtml(club)}"${club === "All Clubs" ? " selected" : ""}>${escapeHtml(club)}</option>`).join("");

  const today = new Date();
  memberDateTo.value = formatInputDate(today);
  memberDateTo.max = formatInputDate(today);
  syncMemberMonthStart();
  memberDateFrom.readOnly = true;
}

function readIso(input) {
  return window.DashboardUI ? window.DashboardUI.readDateInput(input) : input.value;
}

function writeIso(input, iso) {
  if (window.DashboardUI && input.dataset.auDate === "1") window.DashboardUI.setDateInput(input, iso);
  else input.value = iso;
}

function syncMemberMonthStart() {
  const end = parseDate(readIso(memberDateTo) || formatInputDate(new Date()));
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  writeIso(memberDateFrom, formatInputDate(start));
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
  window.DashboardUI?.paintFreshness(state.data.updated, MEMBER_APP_VERSION);
}

function renderMetrics() {
  const totals = visibleTotals();
  setText("#activeMembers", number.format(totals.activeMembers || 0));
  setText("#standardActiveMembers", number.format(standardActive(totals)));
  setText("#fitnessPassportMembers", number.format(totals.fitnessPassportMembers || 0));
  setText("#cancellations", number.format(totals.cancellations || 0));
  setText("#suspensions", number.format(totals.suspensions || 0));
}

function aggregateNewMembers(current, next) {
  return {
    currentWeek: addNewMemberWindow(current.currentWeek, next.currentWeek),
    currentMonthToDate: addNewMemberWindow(current.currentMonthToDate, next.currentMonthToDate)
  };
}

function addNewMemberWindow(current = {}, next = {}) {
  return {
    dateFrom: current.dateFrom || next.dateFrom || "",
    dateTo: current.dateTo || next.dateTo || "",
    total: (current.total || 0) + (next.total || 0)
  };
}

function renderNewMembers() {
  const newMembers = visibleTotals().newMembers || {};
  const cancellations = visibleTotals().revenueCancellations || {};
  const week = newMembers.currentWeek || {};
  const mtd = newMembers.currentMonthToDate || {};
  const cancellationWeek = cancellations.currentWeek || {};
  const cancellationMTD = cancellations.currentMonthToDate || {};
  const weekNmm = (week.total || 0) - (cancellationWeek.total || 0);
  const mtdNmm = (mtd.total || 0) - (cancellationMTD.total || 0);
  setText("#weekNewMembers", number.format(week.total || 0));
  setText("#mtdNewMembers", number.format(mtd.total || 0));
  setText("#weekRevenueCancellations", number.format(cancellationWeek.total || 0));
  setText("#mtdRevenueCancellations", number.format(cancellationMTD.total || 0));
  setSignedMovement("#weekNmm", weekNmm);
  setSignedMovement("#mtdNmm", mtdNmm);
  setText("#weekNewMembersLabel", periodLabel("New Memberships - Current Week", week));
  setText("#mtdNewMembersLabel", periodLabel("New Memberships - MTD", mtd));
  setText("#weekCancellationsLabel", periodLabel("Paid Cancellations - Current Week", cancellationWeek));
  setText("#mtdCancellationsLabel", periodLabel("Paid Cancellations - MTD", cancellationMTD));
  setText("#weekNmmLabel", periodLabel("NMM - Current Week", week));
  setText("#mtdNmmLabel", periodLabel("NMM - MTD", mtd));
}

function periodLabel(label, window) {
  if (!window.dateFrom || !window.dateTo) return label;
  return `${label} (${formatDate(parseHapanaDate(window.dateFrom))} to ${formatDate(parseHapanaDate(window.dateTo))})`;
}

function renderMovement() {
  const movement = visibleTotals().movement || {};
  const previous = movement.previousMonth || {};
  const current = movement.currentMonthToDate || {};

  setText("#previousMovementLabel", previous.label ? `Previous Month Active Membership Packages (${previous.label})` : "Previous Month Active Membership Packages");
  setText("#currentMovementLabel", current.label ? `Current MTD Active Membership Packages (${current.label})` : "Current MTD Active Membership Packages");
  setText("#previousNewSales", number.format(previous.newSales || 0));
  setText("#previousStandardNewSales", number.format(standardNewSales(previous)));
  setText("#previousFitnessPassportNewSales", number.format(previous.fitnessPassportNewSales || 0));
  setText("#previousCancellations", number.format(previous.cancellations || 0));
  setText("#previousSuspensions", number.format(previous.suspensions || 0));
  setText("#currentNewSales", number.format(current.newSales || 0));
  setText("#currentStandardNewSales", number.format(standardNewSales(current)));
  setText("#currentFitnessPassportNewSales", number.format(current.fitnessPassportNewSales || 0));
  setText("#currentCancellations", number.format(visibleTotals().revenueCancellations?.currentMonthToDate?.total ?? current.cancellations ?? 0));
  setText("#currentSuspensions", number.format(current.suspensions || 0));
}

function renderCancellationForecast() {
  const forecast = visibleTotals().cancellationForecast || {};
  const current = forecast.currentMonth || {};
  const next = forecast.nextMonth || {};

  setText("#currentCancellationLabel", current.label ? `Scheduled cancels in ${current.label} (any cancel date in the month)` : "Scheduled cancels this month");
  setText("#nextCancellationLabel", next.label ? `Scheduled cancels in ${next.label}` : "Scheduled cancels next month");
  setText("#currentMonthCancellations", number.format(current.cancellations || 0));
  setText("#nextMonthCancellations", number.format(next.cancellations || 0));
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
        <span><span class="mini-label" data-define="new-profiles">New profiles MTD</span><strong class="mini-value">${number.format(currentMonthNewMemberships(row))}</strong></span>
        <span><span class="mini-label" data-define="paid-cancellations">Paid cancellations MTD</span><strong class="mini-value negative">${number.format(currentMonthCancellations(row))}</strong></span>
        <span><span class="mini-label">Current Suspended</span><strong class="mini-value">${number.format(row.suspensions || 0)}</strong></span>
        <span><span class="mini-label">NMM MTD</span><strong class="mini-value ${movementClass(netMemberMovement(row))}">${formatSigned(netMemberMovement(row))}</strong></span>
      </div>
      ${profileNote(row)}
      ${row.warning ? `<p class="note">${escapeHtml(row.warning)}</p>` : ""}
    </article>
  `).join("");
}

function renderDailyChart() {
  const container = document.querySelector("#dailyActiveTrend");
  const totals = visibleTotals();
  const points = totals.dailyActive || [];
  setText("#dailyChartNote", isAllClubsSelected() ? "All clubs combined." : selectedClubLabel());

  if (!points.length) {
    container.innerHTML = `<p class="trend-empty">No daily active data has been stored yet.</p>`;
    return;
  }

  const width = 980;
  const height = 320;
  const pad = { top: 22, right: 28, bottom: 54, left: 72 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = points.map((point) => point.active || 0);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max(8, Math.round((maxValue - minValue) * 0.25) || 20);
  const yMin = Math.max(0, minValue - padding);
  const yMax = maxValue + padding;
  const yStep = Math.max(1, Math.round((yMax - yMin) / 4));
  const x = (index) => pad.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => pad.top + plotHeight - ((value - yMin) / Math.max(1, yMax - yMin)) * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) => Math.round(yMin + index * yStep));

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
      <td>${number.format(currentMonthCancellations(row))}</td>
      <td>${number.format(row.suspensions || 0)}</td>
      <td>${number.format(currentMonthNewMemberships(row))}</td>
      <td class="${movementClass(netMemberMovement(row))}">${formatSigned(netMemberMovement(row))}</td>
      <td>${row.fallback ? "Fallback" : number.format(row.rowCount || 0)}</td>
    </tr>
  `).join("");
}

function render() {
  renderSource();
  renderMetrics();
  renderNewMembers();
  renderMovement();
  renderCancellationForecast();
  renderPeriod();
  renderSummary();
  renderDailyChart();
  renderDetail();
  renderAttentionPanel();
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${view}View`);
  });
  logMemberDashboardView();
}

clubFilter.addEventListener("change", () => {
  syncClubSelection();
  render();
  logMemberDashboardView();
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

refreshForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshMemberMetrics();
});

memberDateTo.addEventListener("change", syncMemberMonthStart);

async function refreshMemberMetrics() {
  const button = refreshForm.querySelector("button");
  button.disabled = true;
  const originalText = button.textContent;

  try {
    syncMemberMonthStart();
    const failures = [];
    for (const [index, club] of REFRESH_CLUBS.entries()) {
      memberRefreshStatus.textContent = `Updating ${club} (${index + 1} of ${REFRESH_CLUBS.length})...`;
      const params = new URLSearchParams({
        club,
        date_from: toHapanaDate(readIso(memberDateFrom)),
        date_to: toHapanaDate(readIso(memberDateTo)),
        source: "core"
      });
      try {
        const response = await apiFetch(memberApiUrl(params.toString()), {
          headers: { "Accept": "application/json" }
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok && response.status !== 207) {
          throw new Error(errorText(body.error || body || `HTTP ${response.status}`));
        }
        for (const item of body.failures || []) {
          failures.push(`${item.club || club}: ${errorText(item.error)}`);
        }
        if (index === REFRESH_CLUBS.length - 1 && body.pending) {
          const missing = (body.missingClubs || []).join(", ");
          const quality = (body.qualityIssues || []).map((item) => `${item.club}: ${item.warning}`).join(" | ");
          failures.push(`Refresh not published${missing ? `; missing ${missing}` : ""}${quality ? `; ${quality}` : ""}.`);
        }
      } catch (error) {
        failures.push(`${club}: ${errorText(error)}`);
      }
    }

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

function standardNewSales(row) {
  return row.standardNewSales ?? Math.max(0, (row.newSales || 0) - (row.fitnessPassportNewSales || 0));
}

function currentMonthCancellations(row) {
  return row.revenueCancellations?.currentMonthToDate?.total ?? row.cancellations ?? 0;
}

function currentMonthNewMemberships(row) {
  return row.newMembers?.currentMonthToDate?.total ?? row.newMemberships ?? 0;
}

function netMemberMovement(row) {
  return currentMonthNewMemberships(row) - currentMonthCancellations(row);
}

function setSignedMovement(selector, value) {
  const element = document.querySelector(selector);
  element.textContent = formatSigned(value);
  element.classList.remove("positive", "negative", "muted-value");
  element.classList.add(movementClass(value));
}

function movementClass(value) {
  if (value < 0) return "negative";
  if (value > 0) return "positive";
  return "muted-value";
}

function formatSigned(value) {
  if (value > 0) return `+${number.format(value)}`;
  return number.format(value || 0);
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
  try {
    window.DashboardUI?.showStatus("Loading member data…");
    await window.dashboardAuth?.ready;
    await loadMemberData();
    initControls();
    window.DashboardUI?.enhanceDateInputs(document);
    window.DashboardUI?.installClubFilter(clubFilter);
    syncClubSelection();
    render();
    document.body.classList.remove("dashboard-pending");
    window.DashboardUI?.hideStatus();
    logMemberDashboardView();
  } catch (error) {
    document.body.classList.remove("dashboard-pending");
    window.DashboardUI?.showStatus(errorText(error), "error");
  }
}

init();

function logMemberDashboardView() {
  window.dashboardAuth?.logView?.({
    page: "Members",
    view: state.view,
    club: selectedClubLabel()
  });
}
