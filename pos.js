const POS_APP_VERSION = "pos-dashboard-v1-2026-06-10";
const CLUBS = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0
});
const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short"
});

const state = {
  club: "All Clubs",
  data: {
    source: "Hapana Core Net Revenue Detail",
    updated: null,
    dateFrom: "",
    dateTo: "",
    totals: { totalSales: 0, transactionCount: 0, foodAndBeverage: 0, merchandise: 0, fees: 0, other: 0 },
    clubs: [],
    failures: []
  },
  connection: "loading"
};

const clubFilter = document.querySelector("#clubFilter");
const posRefreshForm = document.querySelector("#posRefreshForm");
const posDateFrom = document.querySelector("#posDateFrom");
const posDateTo = document.querySelector("#posDateTo");
const posRefreshStatus = document.querySelector("#posRefreshStatus");

async function loadPosData() {
  try {
    const response = await fetch("/api/pos-metrics?stored=1", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`POS metrics returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.clubs)) throw new Error("POS metrics returned invalid club rows");
    state.data = {
      ...state.data,
      ...payload,
      totals: payload.totals || state.data.totals
    };
    state.connection = payload.clubs.length ? "live" : "empty";
  } catch (error) {
    console.warn("POS metrics could not load.", error);
    state.connection = "error";
  }
}

function initControls() {
  const clubs = ["All Clubs", ...new Set([...CLUBS, ...state.data.clubs.map((row) => row.club)])].filter(Boolean);
  clubFilter.innerHTML = clubs.map((club) => `<option>${escapeHtml(club)}</option>`).join("");

  const today = new Date();
  const end = previousReportableThursday(today);
  const start = addDays(end, -83);
  posDateFrom.value = formatInputDate(start);
  posDateTo.value = formatInputDate(end);
}

function previousReportableThursday(date) {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);
  const daysSinceThursday = (today.getDay() - 4 + 7) % 7;
  return addDays(addDays(today, -daysSinceThursday), -7);
}

function visibleClubs() {
  return state.club === "All Clubs"
    ? state.data.clubs
    : state.data.clubs.filter((row) => row.club === state.club);
}

function visibleTotals() {
  const rows = visibleClubs();
  if (state.club === "All Clubs") return state.data.totals;
  return rows[0] || { totalSales: 0, transactionCount: 0, foodAndBeverage: 0, merchandise: 0, fees: 0, other: 0 };
}

function renderSource() {
  const statuses = {
    loading: "Loading",
    live: "Live Hapana data",
    empty: "No POS data stored",
    error: "POS data unavailable"
  };
  setText("#connectionStatus", statuses[state.connection]);
  setText("#sourceName", state.data.source || "Hapana Core Net Revenue Detail");
  setText("#updatedAt", state.data.updated
    ? `Prepared ${state.data.updated} | ${POS_APP_VERSION}`
    : POS_APP_VERSION);
}

function renderMetrics() {
  const totals = visibleTotals();
  setText("#totalSales", formatMoney(totals.totalSales || 0));
  setText("#foodAndBeverage", formatMoney(totals.foodAndBeverage || 0));
  setText("#merchandise", formatMoney(totals.merchandise || 0));
  setText("#fees", formatMoney(totals.fees || 0));
  setText("#transactionCount", number.format(totals.transactionCount || 0));
}

function renderPeriod() {
  if (state.data.dateFrom && state.data.dateTo) {
    setText("#posPeriod", `${formatDate(parseHapanaDate(state.data.dateFrom))} to ${formatDate(parseHapanaDate(state.data.dateTo))}`);
  } else {
    setText("#posPeriod", "Use Update POS to load the first 12-week period");
  }
  setText("#posSource", state.data.failures?.length
    ? `${state.data.failures.length} club issue(s) need checking`
    : "Net Revenue Detail POS rows from Core Hapana");
}

function renderSummary() {
  const container = document.querySelector("#posSummaryGrid");
  const rows = visibleClubs();

  if (!rows.length) {
    container.innerHTML = `<article class="club-card"><p class="note">No stored POS metrics yet. Select a club and use Update POS after deploying.</p></article>`;
    return;
  }

  container.innerHTML = rows.map((row) => `
    <article class="club-card">
      <div class="card-head">
        <span class="club-name">${escapeHtml(row.club)}</span>
        <span class="status green">POS</span>
      </div>
      <div class="mini-grid">
        <span><span class="mini-label">Total POS</span><strong class="mini-value">${formatMoney(row.totalSales || 0)}</strong></span>
        <span><span class="mini-label">Food & Beverage</span><strong class="mini-value">${formatMoney(row.foodAndBeverage || 0)}</strong></span>
        <span><span class="mini-label">Merchandise</span><strong class="mini-value">${formatMoney(row.merchandise || 0)}</strong></span>
        <span><span class="mini-label">Fees</span><strong class="mini-value">${formatMoney(row.fees || 0)}</strong></span>
      </div>
      <ol class="product-list">
        ${topProducts(row).map((item) => `<li><strong>${escapeHtml(item.name)}</strong><span>${number.format(item.quantity)} sold | ${formatMoney(item.sales)}</span></li>`).join("")}
      </ol>
    </article>
  `).join("");
}

function renderDetail() {
  const body = document.querySelector("#posDetailBody");
  body.innerHTML = visibleClubs().map((row) => {
    const products = topProducts(row);
    return `
      <tr>
        <td>${escapeHtml(row.club)}</td>
        <td>${formatMoney(row.totalSales || 0)}</td>
        <td>${formatMoney(row.foodAndBeverage || 0)}</td>
        <td>${formatMoney(row.merchandise || 0)}</td>
        <td>${formatMoney(row.fees || 0)}</td>
        <td>${formatMoney(row.other || 0)}</td>
        <td>${formatProduct(products[0])}</td>
        <td>${formatProduct(products[1])}</td>
        <td>${formatProduct(products[2])}</td>
        <td>${number.format(row.transactionCount || 0)}</td>
      </tr>
    `;
  }).join("");
}

function render() {
  renderSource();
  renderMetrics();
  renderPeriod();
  renderSummary();
  renderDetail();
}

clubFilter.addEventListener("change", (event) => {
  state.club = event.target.value;
  render();
  logPosDashboardView();
});

posRefreshForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshPosMetrics();
});

async function refreshPosMetrics() {
  const button = posRefreshForm.querySelector("button");
  button.disabled = true;
  const originalText = button.textContent;
  const club = state.club === "All Clubs" ? "Bankstown" : state.club;

  try {
    posRefreshStatus.textContent = `Updating ${club} from Core Hapana...`;
    const params = new URLSearchParams({
      club,
      date_from: toHapanaDate(posDateFrom.value),
      date_to: toHapanaDate(posDateTo.value)
    });
    const response = await fetch(`/api/pos-metrics?${params.toString()}`, {
      headers: { "Accept": "application/json" }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) {
      throw new Error(errorText(body.error || body || `HTTP ${response.status}`));
    }
    const failures = Array.isArray(body.failures)
      ? body.failures.map((item) => `${item.club || "Club"}: ${errorText(item.error)}`)
      : [];

    posRefreshStatus.textContent = "POS data updated. Refreshing dashboard...";
    await loadPosData();
    initControls();
    state.club = club;
    clubFilter.value = club;
    render();
    posRefreshStatus.textContent = failures.length
      ? `Finished with issues: ${failures.join(" | ")}`
      : `${club} POS data updated.`;
  } catch (error) {
    posRefreshStatus.textContent = errorText(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function topProducts(row) {
  return Array.isArray(row.topProducts) ? row.topProducts.slice(0, 3) : [];
}

function formatProduct(item) {
  if (!item) return "";
  return `${escapeHtml(item.name)} (${number.format(item.quantity)} | ${formatMoney(item.sales)})`;
}

function formatMoney(value) {
  return money.format(value || 0);
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

function parseHapanaDate(value) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  return new Date(year, month - 1, day);
}

function toHapanaDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
  await loadPosData();
  initControls();
  render();
  window.dashboardAuth?.ready?.then(logPosDashboardView);
}

function logPosDashboardView() {
  window.dashboardAuth?.logView?.({
    page: "POS",
    view: "overview",
    club: state.club
  });
}

init();
