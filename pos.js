const POS_APP_VERSION = "pos-dashboard-period-v2-2026-06-10";
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
  clubs: ["All Clubs"],
  data: {
    source: "Hapana Core Net Revenue Detail",
    updated: null,
    dateFrom: "",
    dateTo: "",
    periodMode: "rolling12Weeks",
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
  clubFilter.multiple = true;
  clubFilter.size = Math.min(5, clubs.length);
  clubFilter.innerHTML = clubs.map((club) => `<option value="${escapeHtml(club)}">${escapeHtml(club)}</option>`).join("");
  applyClubSelection();

  const rolling = rollingDateInputs();
  posDateFrom.value = rolling.dateFrom;
  posDateTo.value = rolling.dateTo;
}

function previousReportableThursday(date) {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);
  const daysSinceThursday = (today.getDay() - 4 + 7) % 7;
  return addDays(addDays(today, -daysSinceThursday), -7);
}

function visibleClubs() {
  return isAllClubsSelected()
    ? state.data.clubs
    : state.data.clubs.filter((row) => selectedClubNames().includes(row.club));
}

function visibleTotals() {
  const rows = visibleClubs();
  if (isAllClubsSelected()) return state.data.totals;
  return aggregatePosTotals(rows);
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
  applyClubSelection();
}

function applyClubSelection() {
  [...clubFilter.options].forEach((option) => {
    option.selected = state.clubs.includes(option.value);
  });
}

function aggregatePosTotals(rows) {
  return rows.reduce((sum, row) => ({
    totalSales: round2(sum.totalSales + (row.totalSales || 0)),
    transactionCount: sum.transactionCount + (row.transactionCount || 0),
    foodAndBeverage: round2(sum.foodAndBeverage + (row.foodAndBeverage || 0)),
    merchandise: round2(sum.merchandise + (row.merchandise || 0)),
    fees: round2(sum.fees + (row.fees || 0)),
    other: round2(sum.other + (row.other || 0))
  }), { totalSales: 0, transactionCount: 0, foodAndBeverage: 0, merchandise: 0, fees: 0, other: 0 });
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
  const period = visiblePeriod();
  if (period.periodMode === "mixed") {
    setText("#posPeriod", "Mixed club periods");
  } else if (period.dateFrom && period.dateTo) {
    const label = period.periodMode === "custom" ? "Custom period" : "Rolling 12 weeks";
    setText("#posPeriod", `${label}: ${formatDate(parseHapanaDate(period.dateFrom))} to ${formatDate(parseHapanaDate(period.dateTo))}`);
  } else {
    setText("#posPeriod", "Rolling 12 weeks: use Update POS to load the first period");
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

clubFilter.addEventListener("change", () => {
  syncClubSelection();
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
  const clubs = isAllClubsSelected() ? CLUBS : selectedClubNames();
  const rolling = rollingDateInputs();
  const isRolling = posDateFrom.value === rolling.dateFrom && posDateTo.value === rolling.dateTo;

  try {
    const allFailures = [];
    for (const club of clubs) {
      posRefreshStatus.textContent = `Updating ${club} ${isRolling ? "rolling 12 weeks" : "custom dates"} from Core Hapana...`;
      const params = new URLSearchParams({ club });
      if (!isRolling) {
        params.set("date_from", toHapanaDate(posDateFrom.value));
        params.set("date_to", toHapanaDate(posDateTo.value));
      }
      const response = await fetch(`/api/pos-metrics?${params.toString()}`, {
        headers: { "Accept": "application/json" }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 207) {
        throw new Error(errorText(body.error || body || `HTTP ${response.status}`));
      }
      if (Array.isArray(body.failures)) {
        allFailures.push(...body.failures.map((item) => `${item.club || club}: ${errorText(item.error)}`));
      }
    }

    posRefreshStatus.textContent = "POS data updated. Refreshing dashboard...";
    await loadPosData();
    const selected = [...state.clubs];
    initControls();
    state.clubs = selected;
    applyClubSelection();
    render();
    posRefreshStatus.textContent = allFailures.length
      ? `Finished with issues: ${allFailures.join(" | ")}`
      : `${selectedClubLabel()} POS data updated.`;
  } catch (error) {
    posRefreshStatus.textContent = errorText(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function topProducts(row) {
  return Array.isArray(row.topProducts) ? row.topProducts.slice(0, 5) : [];
}

function visiblePeriod() {
  const rows = visibleClubs();
  const periods = rows
    .map((row) => ({
      dateFrom: row.dateFrom || state.data.dateFrom || "",
      dateTo: row.dateTo || state.data.dateTo || "",
      periodMode: row.periodMode || state.data.periodMode || "rolling12Weeks"
    }))
    .filter((period) => period.dateFrom && period.dateTo);

  if (!periods.length) {
    return {
      dateFrom: state.data.dateFrom || "",
      dateTo: state.data.dateTo || "",
      periodMode: state.data.periodMode || "rolling12Weeks"
    };
  }

  const keys = [...new Set(periods.map((period) =>
    `${period.dateFrom}|${period.dateTo}|${period.periodMode}`
  ))];

  return keys.length === 1 ? periods[0] : { dateFrom: "", dateTo: "", periodMode: "mixed" };
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

function rollingDateInputs() {
  const end = previousReportableThursday(new Date());
  const start = addDays(end, -83);
  return {
    dateFrom: formatInputDate(start),
    dateTo: formatInputDate(end)
  };
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

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    club: selectedClubLabel()
  });
}

init();
