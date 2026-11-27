const FITNESS_APP_VERSION = "fitness-kpi-dashboard-v7-2026-10-23";

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0
});
const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });

let fitnessData = {
  updated: "10 Sep 2026",
  periods: [
    { id: "2026-09", label: "September 2026 MTD", range: "1 Sep to 10 Sep 2026" },
    { id: "2026-08", label: "August 2026", range: "1 Aug to 31 Aug 2026" },
    { id: "2026-07", label: "July 2026", range: "1 Jul to 31 Jul 2026" }
  ],
  clubs: ["Bankstown", "Wetherill Park", "580G", "Woolooware"],
  kpiGroups: [
    {
      title: "Class Utilisation Ratio",
      kpis: [
        { key: "totalCheckins", label: "Total Check-ins", type: "number", target: "minimum" },
        { key: "totalClassAttendance", label: "Total Class Attendance", type: "number", target: "minimum" },
        { key: "totalClassCapacity", label: "Total Class Capacity", type: "number", target: "reference" },
        { key: "classParticipationRatio", label: "Class Utilisation Ratio", type: "percent", target: "minimum" }
      ]
    },
    {
      title: "PT Packs Sold / PT Sessions Split Revenue",
      kpis: [
        { key: "ptMmaPacksSold", label: "PT Packs Sold", type: "number", target: "minimum" },
        { key: "paidPtSessions", label: "Paid PT Sessions Performed", type: "number", target: "minimum" },
        { key: "posRevenue", label: "Total Revenue Collected at POS", type: "money", target: "minimum" },
        { key: "sessionSplitIncome", label: "Total Revenue from Sessions-Split Income", type: "money", target: "minimum" }
      ]
    },
    {
      title: "PT Rent Income",
      kpis: [
        { key: "activePts", label: "Current Active PTs", type: "number", target: "minimum" },
        { key: "ptRentCollected", label: "Current PT Rent Collected", type: "money", target: "minimum" }
      ]
    },
    {
      title: "Number Class Performed",
      kpis: [
        { key: "conditioningClassCosts", label: "Total Conditioning Classes $", type: "money", target: "maximum" },
        { key: "skillsClassCosts", label: "Total Skills Classes $", type: "money", target: "maximum" },
        { key: "paidClassCosts", label: "Invoices Paid to Coaches", type: "money", target: "maximum" },
        { key: "classCostBudget", label: "Budget", type: "money", target: "reference" }
      ]
    }
  ],
  rows: [
    row("2026-09", "Bankstown", [7120, 2645, 37.1, 22, 188, 18400, 12800, 9, 7200, 4200, 3300, 7500], [7600, 3000, 39, 26, 205, 21000, 14000, 10, 7800, 4100, 3100, 7200], "Lift class attendance from member check-ins and close the PT pack gap."),
    row("2026-09", "Wetherill Park", [7680, 3355, 43.7, 31, 232, 24600, 16400, 12, 9600, 4500, 3600, 8100], [7500, 3300, 42, 29, 225, 23500, 15800, 12, 9300, 4600, 3500, 8300], "Protect strong utilisation while keeping class costs under budget."),
    row("2026-09", "580G", [5840, 1920, 32.9, 17, 151, 14900, 9800, 7, 5600, 3600, 2900, 6500], [6200, 2300, 37, 22, 175, 18000, 12000, 8, 6400, 3500, 2800, 6200], "Rebuild class utilisation and PT pack sales this week."),
    row("2026-09", "Woolooware", [6410, 2440, 38.1, 24, 172, 17600, 11900, 8, 6800, 3900, 3100, 7000], [6600, 2550, 39, 25, 185, 19000, 12800, 9, 7000, 3900, 3000, 6900], "Near plan; watch sessions performed and paid class costs."),
    row("2026-08", "Bankstown", [22100, 8920, 40.4, 91, 646, 70200, 44600, 10, 29400, 15100, 11900, 27000], [21800, 8500, 39, 88, 640, 69000, 43000, 10, 28600, 15000, 11600, 26600], "August finished ahead on utilisation and PT revenue."),
    row("2026-08", "Wetherill Park", [23650, 10280, 43.5, 104, 702, 79200, 50700, 12, 37200, 16800, 13200, 30000], [23000, 9800, 42, 98, 680, 76000, 48000, 12, 36000, 16900, 13000, 29900], "Strong PT revenue and rent collection; costs slightly high."),
    row("2026-08", "580G", [18320, 6540, 35.7, 72, 498, 54800, 37300, 8, 22400, 12600, 10100, 22700], [19000, 7100, 37, 78, 535, 61000, 38000, 8, 24800, 12800, 10000, 22800], "PT revenue and utilisation were below target."),
    row("2026-08", "Woolooware", [19860, 7710, 38.8, 82, 552, 61300, 40000, 9, 26000, 14200, 10900, 25100], [20000, 7800, 39, 84, 560, 62000, 40000, 9, 26100, 14100, 10800, 24900], "Almost exactly on plan with a small class cost overrun."),
    row("2026-07", "Bankstown", [21450, 8200, 38.2, 84, 612, 66100, 45100, 10, 28200, 14900, 11100, 26000], [21600, 8300, 38.5, 86, 625, 67000, 45000, 10, 28300, 15000, 11200, 26200], "July was stable with minor utilisation and pack gaps."),
    row("2026-07", "Wetherill Park", [22680, 9530, 42, 96, 664, 73100, 48400, 12, 35100, 16000, 12800, 28800], [22400, 9300, 41.5, 94, 660, 72000, 48000, 12, 34800, 16100, 12700, 28800], "Healthy base across all major Fitness KPIs."),
    row("2026-07", "580G", [18840, 6820, 36.2, 76, 521, 58600, 37100, 8, 23600, 12400, 9900, 22300], [18800, 6900, 36.8, 77, 530, 59000, 38000, 8, 24000, 12600, 9900, 22500], "Close to plan; focus stayed on utilisation yield."),
    row("2026-07", "Woolooware", [19520, 7420, 38, 79, 538, 59200, 39600, 9, 25400, 13900, 10500, 24400], [19800, 7600, 38.4, 80, 550, 60000, 40000, 9, 25500, 14000, 10600, 24600], "Steady, with light gaps in class attendance and paid sessions.")
  ]
};

const state = {
  clubs: ["All Clubs"],
  period: fitnessData.periods[0].id,
  view: "scorecard",
  connection: "loading"
};

const clubFilter = document.querySelector("#clubFilter");
const periodFilter = document.querySelector("#periodFilter");
const fitnessRefreshForm = document.querySelector("#fitnessRefreshForm");
const fitnessDateFrom = document.querySelector("#fitnessDateFrom");
const fitnessDateTo = document.querySelector("#fitnessDateTo");
const fitnessRefreshStatus = document.querySelector("#fitnessRefreshStatus");
const fitnessTargetsForm = document.querySelector("#fitnessTargetsForm");
const fitnessTargetsGrid = document.querySelector("#fitnessTargetsGrid");
const fitnessTargetsStatus = document.querySelector("#fitnessTargetsStatus");
const targetClub = document.querySelector("#targetClub");
const coachInvoicesForm = document.querySelector("#coachInvoicesForm");
const coachInvoiceClub = document.querySelector("#coachInvoiceClub");
const coachInvoicesPaid = document.querySelector("#coachInvoicesPaid");
const coachInvoicePeriod = document.querySelector("#coachInvoicePeriod");
const coachInvoicesStatus = document.querySelector("#coachInvoicesStatus");
const slaTrackingForm = document.querySelector("#slaTrackingForm");
const slaTrackingGrid = document.querySelector("#slaTrackingGrid");
const slaTrackingStatus = document.querySelector("#slaTrackingStatus");
const slaClub = document.querySelector("#slaClub");
let allKpis = fitnessData.kpiGroups.flatMap((group) => group.kpis);
let savedTargetsByClub = {};
let manualActualRecords = {};
let slaRecords = {};

const slaGroups = [
  {
    title: "Recruitment Pipeline",
    fields: [
      { key: "activeCandidates", label: "Active Candidates", type: "number", target: 5, mode: "minimum" },
      { key: "applicantsContacted48Pct", label: "Applicants Contacted Within 48h", type: "percent", target: 100, mode: "minimum" },
      { key: "interviews7DaysPct", label: "Shortlist Interviews Within 7 Days", type: "percent", target: 100, mode: "minimum" },
      { key: "onboarding14DaysPct", label: "Onboarding Within 14 Days", type: "percent", target: 100, mode: "minimum" },
      { key: "vacancyFillDays", label: "PT Vacancy Fill Days", type: "number", target: 30, mode: "maximum" }
    ]
  },
  {
    title: "Coach Audits, Training & Program Compliance",
    fields: [
      { key: "coachObservations", label: "Coach Observations", type: "number", target: 5, mode: "minimum" },
      { key: "ptSessionAudits", label: "PT Session Audits", type: "number", target: 3, mode: "minimum" },
      { key: "groupFitnessAudits", label: "Group Fitness Audits", type: "number", target: 3, mode: "minimum" },
      { key: "writtenFeedback48Pct", label: "Written Feedback Within 48h", type: "percent", target: 100, mode: "minimum" },
      { key: "monthlyCoachWorkshops", label: "Monthly Coach Workshops", type: "number", target: 1, mode: "minimum" },
      { key: "programmingCompliancePct", label: "Programming Compliance", type: "percent", target: 95, mode: "minimum" }
    ]
  },
  {
    title: "Reporting Compliance",
    fields: [
      { key: "weeklyReportOnTimePct", label: "Weekly Reporting On Time", type: "percent", target: 100, mode: "minimum" },
      { key: "monthlyReportOnTimePct", label: "Monthly Reporting On Time", type: "percent", target: 100, mode: "minimum" }
    ]
  }
];
const slaFields = slaGroups.flatMap((group) => group.fields);

function row(period, club, actualValues, targetValues, focus) {
  const keys = [
    "totalCheckins",
    "totalClassAttendance",
    "classParticipationRatio",
    "ptMmaPacksSold",
    "paidPtSessions",
    "posRevenue",
    "sessionSplitIncome",
    "activePts",
    "ptRentCollected",
    "conditioningClassCosts",
    "skillsClassCosts",
    "paidClassCosts"
  ];
  const actuals = Object.fromEntries(keys.map((key, index) => [key, actualValues[index]]));
  const targets = Object.fromEntries(keys.map((key, index) => [key, targetValues[index]]));
  actuals.totalClassCapacity = 0;
  actuals.classParticipationRatio = 0;
  targets.totalClassCapacity = 0;
  actuals.classCostBudget = targetValues[12];
  targets.classCostBudget = targetValues[12];
  return { period, club, actuals, targets, focus };
}

function currentRows() {
  const rows = fitnessData.rows.filter((item) => item.period === state.period);
  const visible = isAllClubsSelected() ? rows : rows.filter((item) => state.clubs.includes(item.club));
  const order = window.DashboardLogic.CLUB_ORDER;
  return [...visible].sort((a, b) => order.indexOf(a.club) - order.indexOf(b.club));
}

function isAllClubsSelected() {
  return state.clubs.includes("All Clubs");
}

function selectedClubLabel() {
  return isAllClubsSelected() ? "All Clubs" : state.clubs.join(", ");
}

function aggregateRows(rows) {
  const totals = rows.reduce((sum, item) => {
    for (const kpi of allKpis) {
      sum.actuals[kpi.key] = round1((sum.actuals[kpi.key] || 0) + (item.actuals[kpi.key] || 0));
      sum.targets[kpi.key] = round1((sum.targets[kpi.key] || 0) + (item.targets[kpi.key] || 0));
    }
    return sum;
  }, { actuals: {}, targets: {} });

  totals.actuals.classParticipationRatio = utilisationRatio(
    totals.actuals.totalClassAttendance,
    totals.actuals.totalClassCapacity
  );
  const targetWeight = rows.reduce((sum, item) => sum + (item.targets.totalClassCapacity || item.actuals.totalClassCapacity || 0), 0);
  totals.targets.classParticipationRatio = targetWeight
    ? round1(rows.reduce((sum, item) => {
      const weight = item.targets.totalClassCapacity || item.actuals.totalClassCapacity || 0;
      return sum + ((item.targets.classParticipationRatio || 0) * weight);
    }, 0) / targetWeight)
    : round1(rows.reduce((sum, item) => sum + (item.targets.classParticipationRatio || 0), 0) / Math.max(rows.length, 1));
  totals.actuals.classCostBudget = totals.actuals.paidClassCosts || 0;
  return totals;
}

function visibleTotals() {
  return aggregateRows(currentRows());
}

function statusFor(actual, target, mode = "minimum") {
  if (!target || mode === "reference") return "pending";
  const ratio = actual / target;
  if (mode === "maximum") {
    if (ratio <= 1) return "green";
    if (ratio <= 1.1) return "amber";
    return "red";
  }
  if (ratio >= 1) return "green";
  if (ratio >= 0.9) return "amber";
  return "red";
}

function statusText(status) {
  return { green: "GREEN", amber: "WATCH", red: "RED", pending: "INFO" }[status] || "INFO";
}

function clubStatus(item) {
  const rows = currentRows();
  const statuses = allKpis
    .filter((kpi) => kpi.target !== "reference" && !metricMissing(item, kpi, rows))
    .map((kpi) => statusFor(item.actuals[kpi.key], kpi.key === "paidClassCosts" ? item.targets.classCostBudget : item.targets[kpi.key], kpi.target));
  if (!statuses.length) return "pending";
  if (statuses.includes("red")) return "red";
  if (statuses.includes("amber")) return "amber";
  return "green";
}

function formatValue(value, type) {
  if (type === "money") return money.format(value || 0);
  if (type === "percent") return `${percent.format(value || 0)}%`;
  return number.format(value || 0);
}

function targetLabel(kpi, target) {
  if (kpi.key === "totalClassCapacity") return "Manual entry";
  if (kpi.target === "maximum") return `Budget ${formatValue(target, kpi.type)}`;
  if (kpi.target === "reference") return "Reference budget";
  return `Target ${formatValue(target, kpi.type)}`;
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function utilisationRatio(attendance, capacity) {
  return capacity ? round1(((attendance || 0) / capacity) * 100) : 0;
}

function normaliseFitnessRow(item) {
  const actuals = { ...(item.actuals || {}) };
  actuals.totalClassCapacity = Number(actuals.totalClassCapacity || item.targets?.totalClassCapacity || 0);
  actuals.classParticipationRatio = utilisationRatio(
    actuals.totalClassAttendance,
    actuals.totalClassCapacity
  );
  return {
    ...item,
    actuals,
    focus: String(item.focus || "").replace(/participation/gi, "utilisation")
  };
}

function normaliseKpiGroups(groups) {
  return groups.map((group) => ({
    ...group,
    title: group.title === "Class Participation Ratio" ? "Class Utilisation Ratio" : group.title,
    kpis: group.kpis.map((kpi) => ({
      ...kpi,
      label: kpi.key === "classParticipationRatio" ? "Class Utilisation Ratio" : kpi.label
    }))
  }));
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

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function apiFetch(url, options) {
  return (window.DashboardUI?.fetch || fetch)(url, options);
}

function metricMissing(item, kpi, rows = currentRows()) {
  const value = item.actuals?.[kpi.key];
  if (value === null || value === undefined || value === "") return true;
  if (kpi.key === "classParticipationRatio" || kpi.key === "totalClassCapacity") {
    return !Number(item.actuals.totalClassCapacity);
  }
  const unstoredWhenZero = ["ptMmaPacksSold", "paidPtSessions", "posRevenue", "sessionSplitIncome", "conditioningClassCosts", "skillsClassCosts", "paidClassCosts", "ptRentCollected", "activePts"];
  if (!unstoredWhenZero.includes(kpi.key)) return false;
  return rows.every((row) => !Number(row.actuals?.[kpi.key]));
}

function initControls() {
  const clubs = window.DashboardLogic.orderClubs(["All Clubs", ...fitnessData.clubs]);
  clubFilter.multiple = true;
  clubFilter.size = Math.min(5, clubs.length);
  clubFilter.innerHTML = clubs.map((club) => `<option value="${escapeHtml(club)}"${club === "All Clubs" ? " selected" : ""}>${escapeHtml(club)}</option>`).join("");
  periodFilter.innerHTML = periodOptionsHtml();
  periodFilter.value = `stored:${state.period}`;
  targetClub.innerHTML = fitnessData.clubs.map((club) => `<option value="${escapeHtml(club)}">${escapeHtml(club)}</option>`).join("");
  if (!targetClub.value) targetClub.value = fitnessData.clubs[0] || "";
  coachInvoiceClub.innerHTML = fitnessData.clubs.map((club) => `<option value="${escapeHtml(club)}">${escapeHtml(club)}</option>`).join("");
  if (!coachInvoiceClub.value) coachInvoiceClub.value = fitnessData.clubs[0] || "";
  slaClub.innerHTML = fitnessData.clubs.map((club) => `<option value="${escapeHtml(club)}">${escapeHtml(club)}</option>`).join("");
  if (!slaClub.value) slaClub.value = fitnessData.clubs[0] || "";

  const dates = latestWeekInputs();
  fitnessDateFrom.value = dates.dateFrom;
  fitnessDateTo.value = dates.dateTo;
}

async function syncFitnessDatesWithDdWeek() {
  try {
    const response = await apiFetch("/api/hapana", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`DD week returned ${response.status}`);
    const payload = await response.json();
    if (!payload.dateFrom || !payload.dateTo) return;
    fitnessDateFrom.value = inputDateFromHapana(payload.dateFrom);
    fitnessDateTo.value = inputDateFromHapana(payload.dateTo);
  } catch (error) {
    console.warn("DD week dates could not load for Fitness refresh defaults.", error);
  }
}

function syncClubSelection() {
  const values = [...clubFilter.selectedOptions].map((option) => option.value);
  state.clubs = !values.length || values.includes("All Clubs") ? ["All Clubs"] : values;
  [...clubFilter.options].forEach((option) => {
    option.selected = state.clubs.includes(option.value);
  });
}

function periodOptionsHtml() {
  return window.DashboardLogic.presentPeriods(fitnessData.periods).map((period) =>
    `<option value="stored:${escapeHtml(period.id)}">${escapeHtml(period.label)}</option>`
  ).join("");
}

function renderRangeOption(option) {
  return `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
}

function quickPeriodOptions() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const mtd = [{
    label: `${monthName(today)} MTD (${displayInputRange(monthStart, today)})`,
    value: rangeOptionValue("mtd", monthStart, today)
  }];

  const months = Array.from({ length: 6 }, (_, index) => {
    const first = new Date(today.getFullYear(), today.getMonth() - index - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth() - index, 0);
    return {
      label: `${monthName(first)} (${displayInputRange(first, last)})`,
      value: rangeOptionValue("month", first, last)
    };
  });

  const latest = latestWeekInputs();
  const latestEnd = parseInputDate(latest.dateTo);
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const end = addDays(latestEnd, index * -7);
    const start = addDays(end, -6);
    return {
      label: `Week ending ${displayInputDate(end)} (${displayInputRange(start, end)})`,
      value: rangeOptionValue("week", start, end)
    };
  });

  return { mtd, months, weeks };
}

function rangeOptionValue(mode, start, end) {
  return `range:${mode}:${formatInputDate(start)}:${formatInputDate(end)}`;
}

function monthName(date) {
  return new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(date);
}

function displayInputDate(date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function displayInputRange(start, end) {
  return `${displayInputDate(start)} to ${displayInputDate(end)}`;
}

function parseInputDate(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

function renderSource() {
  const statuses = {
    loading: "Loading",
    live: "Live Hapana data",
    empty: "No Fitness data stored",
    fallback: "Planning model",
    error: "Fitness data unavailable"
  };
  setText("#connectionStatus", statuses[state.connection] || "Fitness data");
  setText("#sourceName", fitnessData.source || "Fitness department KPI tracker");
  window.DashboardUI?.paintFreshness(fitnessData.updated, FITNESS_APP_VERSION);
}

function renderMetrics() {
  const rows = currentRows();
  const totals = visibleTotals();
  const statuses = allKpis
    .filter((kpi) => kpi.target !== "reference" && !metricMissing({ actuals: totals.actuals }, kpi, rows))
    .map((kpi) => statusFor(totals.actuals[kpi.key], totals.targets[kpi.key], kpi.target));
  const greenCount = statuses.filter((status) => status === "green").length;

  setText("#totalCheckins", formatValue(totals.actuals.totalCheckins, "number"));
  setText("#classAttendance", formatValue(totals.actuals.totalClassAttendance, "number"));
  const capacityMissing = !Number(totals.actuals.totalClassCapacity);
  const packsMissing = metricMissing({ actuals: totals.actuals }, { key: "ptMmaPacksSold" }, rows);
  setText("#classCapacity", capacityMissing ? "No data" : formatValue(totals.actuals.totalClassCapacity, "number"));
  setText("#participationRatio", capacityMissing ? "No data" : formatValue(totals.actuals.classParticipationRatio, "percent"));
  setText("#ptPacksSold", packsMissing ? "No data" : formatValue(totals.actuals.ptMmaPacksSold, "number"));
  setText("#kpiHealth", rows.length ? `${greenCount}/${statuses.length}` : "0/0");
  const slaRows = currentSlaRows();
  setText("#slaComplianceMetric", slaRows.some(slaEntered) ? `${formatValue(slaScoreForRows(slaRows), "percent")}` : "No data");
}

function renderPeriod() {
  const period = fitnessData.periods.find((item) => item.id === state.period);
  const focusRow = currentRows().find((item) => clubStatus(item) === "red");
  const focus = focusRow ? clubFocus(focusRow) : "All selected clubs are tracking within range.";
  setText("#fitnessPeriod", period ? period.range : "");
  setText("#managementFocus", focus);
}

function renderScorecard() {
  const container = document.querySelector("#fitnessScorecard");
  const rows = currentRows();
  if (!rows.length) {
    container.innerHTML = `<article class="club-card"><p class="note">No Fitness KPI data exists for this selection yet.</p></article>`;
    return;
  }

  container.innerHTML = rows.map((item) => {
    const groups = fitnessData.kpiGroups.map((group) => `
      <section class="fitness-kpi-section">
        <h3>${escapeHtml(group.title)}</h3>
        <div class="fitness-kpi-grid">
          ${group.kpis.map((kpi) => renderKpi(item, kpi)).join("")}
        </div>
      </section>
    `).join("");

    return `
      <article class="fitness-club-card">
        <div class="card-head">
          <span class="club-name">${escapeHtml(item.club)}</span>
          <span class="status ${clubStatus(item)}">${statusText(clubStatus(item))}</span>
        </div>
        ${groups}
        <p class="note">${escapeHtml(clubFocus(item))}</p>
      </article>
    `;
  }).join("");
}

function renderKpi(item, kpi) {
  if (metricMissing(item, kpi)) {
    return `
    <div class="fitness-kpi">
      <div>
        <span class="mini-label">${escapeHtml(kpi.label)}</span>
        <strong class="mini-value">No data</strong>
      </div>
      <span class="status pending">NO DATA</span>
      <div class="progress" aria-label="${escapeHtml(kpi.label)} progress"><span class="pending" style="width:0%"></span></div>
      <span class="target-note">Not entered for this period</span>
    </div>`;
  }
  const actual = item.actuals[kpi.key] || 0;
  const target = kpi.key === "paidClassCosts" ? item.targets.classCostBudget : item.targets[kpi.key] || 0;
  const status = kpi.target === "maximum" && !actual ? "pending" : statusFor(actual, target, kpi.target);
  const progress = progressFor(actual, target, kpi.target);
  return `
    <div class="fitness-kpi">
      <div>
        <span class="mini-label">${escapeHtml(kpi.label)}</span>
        <strong class="mini-value">${formatValue(actual, kpi.type)}</strong>
      </div>
      <span class="status ${status}">${statusText(status)}</span>
      <div class="progress" aria-label="${escapeHtml(kpi.label)} progress">
        <span class="${status}" style="width:${progress}%"></span>
      </div>
      <span class="target-note">${targetLabel(kpi, target)}</span>
    </div>
  `;
}

function progressFor(actual, target, mode) {
  if (!target) return 0;
  if (mode === "maximum") return Math.min(100, Math.max(0, 100 - Math.max(0, ((actual - target) / target) * 100)));
  return Math.min(100, Math.max(0, (actual / target) * 100));
}

function renderParticipation() {
  const rows = currentRows();
  const container = document.querySelector("#participationGrid");
  setText("#trendNote", isAllClubsSelected() ? "All clubs combined." : selectedClubLabel());
  renderTrend();
  container.innerHTML = rows.map((item) => {
    const status = statusFor(item.actuals.classParticipationRatio, item.targets.classParticipationRatio);
    return `
      <article class="club-card">
        <div class="card-head">
          <span class="club-name">${escapeHtml(item.club)}</span>
          <span class="status ${status}">${statusText(status)}</span>
        </div>
        <div class="mini-grid">
          <span><span class="mini-label">Total Check-ins</span><strong class="mini-value">${number.format(item.actuals.totalCheckins || 0)}</strong></span>
          <span><span class="mini-label">Class Attendance</span><strong class="mini-value">${number.format(item.actuals.totalClassAttendance || 0)}</strong></span>
          <span><span class="mini-label">Class Capacity</span><strong class="mini-value">${number.format(item.actuals.totalClassCapacity || 0)}</strong></span>
          <span><span class="mini-label">Utilisation Ratio</span><strong class="mini-value">${formatValue(item.actuals.classParticipationRatio, "percent")}</strong></span>
          <span><span class="mini-label">Ratio Target</span><strong class="mini-value">${formatValue(item.targets.classParticipationRatio, "percent")}</strong></span>
        </div>
      </article>
    `;
  }).join("");
}

function trendDateRange(period) {
  const formatDate = (value) => {
    const text = String(value || "");
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const hapana = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (!iso && !hapana) return "";
    const [, year, month, day] = iso || [null, hapana[3], hapana[2], hapana[1]];
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return "";
    return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(/\bSept\b/g, "Sep");
  };
  const from = formatDate(period.dateFrom);
  const to = formatDate(period.dateTo);
  if (from && to) return `${from} to ${to}`;
  let range = String(period.range || period.label || "").replace(/^(?:Custom|Week ending)\s+/i, "");
  const year = /\b(\d{4})\b/.exec(range)?.[1];
  if (year) range = range.replace(/^(\d{1,2}\s+[A-Za-z]+)\s+to\s+/, `$1 ${year} to `);
  return range.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, (month) => month.slice(0, 3))
    .replace(/\bSept\b/g, "Sep").replace(/\b\d{4}\b/g, (year) => year.slice(-2));
}

function renderTrend() {
  const container = document.querySelector("#fitnessTrend");
  const periods = [...fitnessData.periods].reverse();
  const values = periods.map((period) => {
    const rows = fitnessData.rows.filter((item) =>
      item.period === period.id && (isAllClubsSelected() || state.clubs.includes(item.club))
    );
    if (!rows.length || rows.some((item) => !(Number(item.actuals.totalClassCapacity) > 0))) return null;
    const totals = aggregateRows(rows);
    return totals.actuals.classParticipationRatio;
  });
  const width = Math.max(640, container.clientWidth || 980);
  if (!container.trendResizeObserver && typeof ResizeObserver !== "undefined") {
    let lastWidth = container.clientWidth;
    container.trendResizeObserver = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientWidth !== lastWidth) {
        lastWidth = container.clientWidth;
        renderTrend();
      }
    });
    container.trendResizeObserver.observe(container);
  }
  const dateLabels = periods.map((period) => {
    const end = window.DashboardLogic.parseDayMonthYear(period.dateTo);
    return end ? window.DashboardLogic.formatDay(end).replace(/ \d{4}$/, "") : trendDateRange(period);
  });
  const labelExtent = Math.ceil(Math.max(80, ...dateLabels.map((label) => label.length * 7)) / Math.sqrt(2));
  const pad = { top: 22, right: labelExtent + 24, bottom: labelExtent + 40, left: 66 };
  const height = 266 + pad.bottom;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const yMax = Math.max(50, Math.ceil(Math.max(...values, 1) / 10) * 10);
  const x = (index) => pad.left + (periods.length === 1 ? plotWidth / 2 : (index / (periods.length - 1)) * plotWidth);
  const y = (value) => pad.top + plotHeight - (value / yMax) * plotHeight;
  const yTicks = Array.from({ length: Math.floor(yMax / 10) + 1 }, (_, index) => index * 10);
  const grid = yTicks.map((tick) => `
    <line class="trend-grid" x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}"></line>
    <text class="trend-label" x="${pad.left - 12}" y="${y(tick) + 4}" text-anchor="end">${tick}%</text>
  `).join("");
  const labelWidth = 40;
  const maxLabels = Math.max(2, Math.floor(plotWidth / labelWidth));
  const labelStep = Math.max(1, Math.ceil((periods.length - 1) / (maxLabels - 1)));
  const labels = periods.map((period, index) => {
    const lastIndex = periods.length - 1;
    if (index !== lastIndex && (index % labelStep !== 0 || (index > 0 && lastIndex - index < labelStep))) return "";
    const labelY = height - pad.bottom + 24;
    return `<text class="trend-label" x="${x(index)}" y="${labelY}" text-anchor="start" transform="rotate(45 ${x(index)} ${labelY})">${escapeHtml(dateLabels[index])}</text>`;
  }).join("");
  const path = values.map((value, index) => value === null ? "" : `${index === 0 || values[index - 1] === null ? "M" : "L"} ${x(index)},${y(value)}`).join(" ");
  const dots = values.map((value, index) => value === null ? "" : `
    <circle class="trend-dot" cx="${x(index)}" cy="${y(value)}" r="4.2" fill="#c8112e">
      <title>${escapeHtml(periods[index].label)}: ${formatValue(value, "percent")}</title>
    </circle>
  `).join("");
  container.innerHTML = `
    ${values.includes(null) || !values.length ? `<p class="fitness-trend-notice" role="status">${values.some((value) => value !== null) ? "Gaps indicate unavailable utilisation data." : "Utilisation data is unavailable for this selection."} Enter class capacity for each selected club and period in Targets to calculate utilisation.</p>` : ""}
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Class utilisation ratio trend line graph">
      ${grid}
      <line class="trend-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
      <line class="trend-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
      ${labels}
      <path class="trend-line" d="${path}" stroke="#c8112e"></path>
      ${dots}
    </svg>
  `;
}

function renderPtRevenue() {
  const body = document.querySelector("#ptRevenueBody");
  body.innerHTML = currentRows().map((item) => {
    const missingPacks = metricMissing(item, { key: "ptMmaPacksSold" });
    const missingSessions = metricMissing(item, { key: "paidPtSessions" });
    const missingPos = metricMissing(item, { key: "posRevenue" });
    const missingSplit = metricMissing(item, { key: "sessionSplitIncome" });
    const status = missingPacks ? "pending" : statusFor(item.actuals.ptMmaPacksSold, item.targets.ptMmaPacksSold);
    const totalRevenue = (missingPos ? 0 : item.actuals.posRevenue || 0) + (missingSplit ? 0 : item.actuals.sessionSplitIncome || 0);
    const cell = (missing, text) => missing ? "No data" : text;
    return `
      <tr>
        <td>${escapeHtml(item.club)}</td>
        <td>${cell(missingPacks, number.format(item.actuals.ptMmaPacksSold || 0))}</td>
        <td>${cell(missingSessions, number.format(item.actuals.paidPtSessions || 0))}</td>
        <td>${cell(missingPos, money.format(item.actuals.posRevenue || 0))}</td>
        <td>${cell(missingSplit, money.format(item.actuals.sessionSplitIncome || 0))}</td>
        <td>${missingPos && missingSplit ? "No data" : money.format(totalRevenue)}</td>
        <td><span class="status ${status}">${missingPacks ? "NO DATA" : statusText(status)}</span></td>
      </tr>
    `;
  }).join("");
}

function renderRentCosts() {
  const body = document.querySelector("#rentCostsBody");
  body.innerHTML = currentRows().map((item) => {
    const invoiceAmount = Number(item.actuals.paidClassCosts || 0);
    const status = statusFor(invoiceAmount, item.targets.classCostBudget, "maximum");
    return `
      <tr>
        <td>${escapeHtml(item.club)}</td>
        <td>${number.format(item.actuals.activePts || 0)}</td>
        <td>${money.format(item.actuals.ptRentCollected || 0)}</td>
        <td>${money.format(item.actuals.conditioningClassCosts || 0)}</td>
        <td>${money.format(item.actuals.skillsClassCosts || 0)}</td>
        <td>${invoiceAmount ? money.format(invoiceAmount) : "No data"}</td>
        <td>${money.format(item.targets.classCostBudget || 0)}</td>
        <td>${invoiceAmount ? `<span class="status ${status}">${statusText(status)}</span>` : `<span class="status pending">NO DATA</span>`}</td>
      </tr>
    `;
  }).join("");
}

function renderActions() {
  const container = document.querySelector("#fitnessActions");
  const rows = currentRows();
  const severityRank = { red: 0, amber: 1, missing: 2 };
  const actions = rows.flatMap((item) =>
    allKpis
      .filter((kpi) => kpi.target !== "reference")
      .map((kpi) => {
        const missing = metricMissing(item, kpi, rows);
        const target = kpi.key === "paidClassCosts" ? item.targets.classCostBudget : item.targets[kpi.key];
        return {
          club: item.club,
          kpi,
          actual: item.actuals[kpi.key] || 0,
          target: target || 0,
          missing,
          status: missing ? "missing" : statusFor(item.actuals[kpi.key] || 0, target, kpi.target)
        };
      })
      .filter((action) => action.status === "red" || action.status === "amber" || action.status === "missing")
  ).sort((a, b) => {
    const clubOrder = window.DashboardLogic.orderClubs([a.club, b.club]);
    if (a.club !== b.club) return clubOrder[0] === a.club ? -1 : 1;
    return severityRank[a.status] - severityRank[b.status];
  });

  if (!actions.length) {
    container.innerHTML = `<article class="club-card"><p class="note">No under-target Fitness KPIs for the current selection.</p></article>`;
    return;
  }

  let lastClub = "";
  container.innerHTML = actions.map((item) => {
    const heading = item.club === lastClub ? "" : `<h3 class="action-club">${escapeHtml(item.club)}</h3>`;
    lastClub = item.club;
    const gap = item.kpi.target === "maximum" ? item.actual - item.target : item.target - item.actual;
    const message = item.missing
      ? `${item.kpi.label} has no data for this period.`
      : item.kpi.target === "maximum"
        ? `${item.kpi.label} is ${formatValue(Math.max(0, gap), item.kpi.type)} over the budget of ${formatValue(item.target, item.kpi.type)}.`
        : `${item.kpi.label} is ${formatValue(Math.max(0, gap), item.kpi.type)} below the target of ${formatValue(item.target, item.kpi.type)}.`;
    const badge = item.missing ? "NO DATA" : statusText(item.status);
    return `
      ${heading}
      <article class="action-card">
        <div>
          <span class="status ${item.missing ? "pending" : item.status}">${badge}</span>
          <h3>${escapeHtml(item.kpi.label)}</h3>
          <p>${escapeHtml(message)}</p>
        </div>
        <strong>${item.missing ? "No data" : formatValue(item.actual, item.kpi.type)}</strong>
      </article>
    `;
  }).join("");
}

function currentSlaRows() {
  const clubs = isAllClubsSelected() ? fitnessData.clubs : state.clubs;
  return clubs.filter((club) => club !== "All Clubs").map((club) => slaRowFor(club));
}

function slaRowFor(club) {
  const key = slaRecordKey(state.period, club);
  const stored = slaRecords[key] || {};
  return {
    period: state.period,
    club,
    actuals: {
      ...blankSlaActuals(),
      ...(stored.actuals || {})
    }
  };
}

function blankSlaActuals() {
  return Object.fromEntries(slaFields.map((field) => [field.key, 0]));
}

function slaRecordKey(period, club) {
  return `${period}::${club}`;
}

function slaStatusFor(value, field) {
  if (!value) return "pending";
  if (field.mode === "maximum") {
    if (!value) return "pending";
    if (value <= field.target) return "green";
    if (value <= field.target * 1.1) return "amber";
    return "red";
  }
  if (value >= field.target) return "green";
  if (value >= field.target * 0.9) return "amber";
  return "red";
}

function slaScoreForRows(rows, fields = slaFields) {
  const statuses = rows.flatMap((row) =>
    fields.map((field) => slaStatusFor(row.actuals[field.key], field))
  ).filter((status) => status !== "pending");
  if (!statuses.length) return null;
  const points = statuses.reduce((sum, status) => sum + (status === "green" ? 1 : status === "amber" ? 0.5 : 0), 0);
  return round1((points / statuses.length) * 100);
}

function renderRecruitment() {
  const container = document.querySelector("#recruitmentGrid");
  const fields = slaGroups[0].fields;
  container.innerHTML = currentSlaRows().map((row) => renderSlaClubCard(row, fields)).join("") ||
    `<article class="club-card"><p class="note">No clubs selected.</p></article>`;
}

function renderCoachCompliance() {
  const container = document.querySelector("#coachComplianceGrid");
  const fields = slaGroups[1].fields;
  container.innerHTML = currentSlaRows().map((row) => renderSlaClubCard(row, fields)).join("") ||
    `<article class="club-card"><p class="note">No clubs selected.</p></article>`;
}

function renderSlaCompliance() {
  const container = document.querySelector("#slaComplianceGrid");
  const rows = currentSlaRows();
  if (!rows.length) {
    container.innerHTML = `<article class="club-card"><p class="note">No clubs selected.</p></article>`;
    return;
  }

  container.innerHTML = rows.map((row) => {
    const entered = slaEntered(row);
    const score = slaScoreForRows([row]);
    const showScore = (fields) => {
      const value = slaScoreForRows([row], fields);
      return value === null ? "No data" : formatValue(value, "percent");
    };
    const status = !entered || score === null ? "pending" : score >= 90 ? "green" : score >= 75 ? "amber" : "red";
    return `
      <article class="club-card">
        <div class="card-head">
          <span class="club-name">${escapeHtml(row.club)}</span>
          <span class="status ${status}">${entered ? statusText(status) : "NO DATA"}</span>
        </div>
        <div class="mini-grid">
          <span><span class="mini-label">SLA Compliance</span><strong class="mini-value">${score === null ? "No data" : formatValue(score, "percent")}</strong></span>
          <span><span class="mini-label">Recruitment</span><strong class="mini-value">${showScore(slaGroups[0].fields)}</strong></span>
          <span><span class="mini-label">Audits & Training</span><strong class="mini-value">${showScore(slaGroups[1].fields)}</strong></span>
          <span><span class="mini-label">Reporting</span><strong class="mini-value">${showScore(slaGroups[2].fields)}</strong></span>
        </div>
      </article>
    `;
  }).join("");
}

function slaEntered(row) {
  return slaFields.some((field) => Number(row.actuals?.[field.key]) > 0);
}

function renderSlaClubCard(row, fields) {
  const entered = slaEntered(row);
  const score = slaScoreForRows([row], fields);
  const status = !entered ? "pending" : score >= 90 ? "green" : score >= 75 ? "amber" : "red";
  return `
    <article class="club-card">
      <div class="card-head">
        <span class="club-name">${escapeHtml(row.club)}</span>
        <span class="status ${status}">${entered ? statusText(status) : "NO DATA"}</span>
      </div>
      <div class="sla-item-grid">
        ${fields.map((field) => renderSlaMini(row, field)).join("")}
      </div>
    </article>
  `;
}

function renderSlaMini(row, field) {
  const value = Number(row.actuals[field.key] || 0);
  if (!value) {
    return `
    <span class="sla-mini">
      <span class="mini-label">${escapeHtml(field.label)}</span>
      <strong class="mini-value">No data</strong>
      <span class="target-note">${field.mode === "maximum" ? "Target max" : "Target"} ${formatValue(field.target, field.type)}</span>
      <span class="status pending">NO DATA</span>
    </span>`;
  }
  const status = slaStatusFor(value, field);
  return `
    <span class="sla-mini">
      <span class="mini-label">${escapeHtml(field.label)}</span>
      <strong class="mini-value">${formatValue(value, field.type)}</strong>
      <span class="target-note">${field.mode === "maximum" ? "Target max" : "Target"} ${formatValue(field.target, field.type)}</span>
      <span class="status ${status}">${statusText(status)}</span>
    </span>
  `;
}

function renderSlaEditor() {
  const club = slaClub.value || fitnessData.clubs[0] || "";
  if (!club || !slaTrackingGrid) return;
  const row = slaRowFor(club);
  slaTrackingGrid.innerHTML = slaGroups.map((group) => `
    <section class="target-group">
      <h3>${escapeHtml(group.title)}</h3>
      <div class="target-input-grid">
        ${group.fields.map((field) => renderSlaInput(field, row.actuals[field.key])).join("")}
      </div>
    </section>
  `).join("");
}

function renderSlaInput(field, value) {
  const suffix = field.type === "percent" ? "%" : "";
  return `
    <label class="target-input-card">
      <span>${escapeHtml(field.label)}</span>
      <div class="target-input-shell">
        <input
          type="number"
          min="0"
          step="${field.type === "percent" ? "0.1" : "1"}"
          name="${escapeHtml(field.key)}"
          value="${Number(value || 0)}"
          inputmode="decimal"
          required
        >
        ${suffix ? `<b>${suffix}</b>` : ""}
      </div>
      <small>${field.mode === "maximum" ? "Maximum" : "Minimum"} ${formatValue(field.target, field.type)}</small>
    </label>
  `;
}

function selectedSlaValues() {
  const formData = new FormData(slaTrackingForm);
  return Object.fromEntries(slaFields.map((field) => {
    const raw = formData.get(field.key);
    return [field.key, raw === null || raw === "" ? 0 : Number(raw)];
  }));
}

async function loadFitnessSla() {
  try {
    const response = await apiFetch("/api/fitness-sla", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Fitness SLA tracking returned ${response.status}`);
    const payload = await response.json();
    slaRecords = payload.records || {};
  } catch (error) {
    console.warn("Fitness SLA tracking could not load.", error);
  }
}

async function saveFitnessSla() {
  if (!window.DashboardUI?.confirmSave("Save SLA tracking for this club and period?")) return;
  const button = slaTrackingForm.querySelector("button");
  const originalText = button.textContent;
  const period = fitnessData.periods.find((item) => item.id === state.period) || {};
  button.disabled = true;
  button.textContent = "Saving...";
  slaTrackingStatus.textContent = "Saving SLA tracking...";

  try {
    const response = await apiFetch("/api/fitness-sla", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        period: state.period,
        periodLabel: period.label || state.period,
        periodRange: period.range || "",
        club: slaClub.value,
        actuals: selectedSlaValues()
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorText(payload.error || `HTTP ${response.status}`));
    slaRecords = payload.records || {};
    render();
    slaTrackingStatus.textContent = `SLA tracking saved for ${slaClub.value}.`;
  } catch (error) {
    slaTrackingStatus.textContent = errorText(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderTargetsEditor() {
  const club = targetClub.value || fitnessData.clubs[0] || "";
  const item = fitnessData.rows.find((row) => row.club === club && row.period === state.period)
    || fitnessData.rows.find((row) => row.club === club);
  const currentTargets = {
    ...(item?.targets || {}),
    ...(savedTargetsByClub[club] || {})
  };

  if (!club || !fitnessTargetsGrid) return;

  fitnessTargetsGrid.innerHTML = fitnessData.kpiGroups.map((group) => `
    <section class="target-group">
      <h3>${escapeHtml(group.title)}</h3>
      <div class="target-input-grid">
        ${group.kpis.map((kpi) => renderTargetInput(kpi, currentTargets[kpi.key])).join("")}
      </div>
    </section>
  `).join("");
}

function manualActualKey(period, club) {
  return `${period}::${club}`;
}

function renderCoachInvoicesEditor() {
  if (!coachInvoiceClub || !coachInvoicesPaid) return;
  const period = fitnessData.periods.find((item) => item.id === state.period);
  const record = manualActualRecords[manualActualKey(state.period, coachInvoiceClub.value)];
  coachInvoicesPaid.value = Number(record?.coachInvoicesPaid || 0);
  coachInvoicePeriod.textContent = period
    ? `${period.label}${period.range ? ` - ${period.range}` : ""}`
    : state.period;
}

function applyManualActuals(records = {}) {
  manualActualRecords = records || {};
  fitnessData.rows = fitnessData.rows.map((item) => {
    const record = manualActualRecords[manualActualKey(item.period, item.club)];
    return {
      ...item,
      actuals: {
        ...item.actuals,
        paidClassCosts: Number(record?.coachInvoicesPaid) || 0
      }
    };
  });
}

async function loadManualActuals() {
  try {
    const response = await apiFetch("/api/fitness-manual-actuals", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Coach invoices returned ${response.status}`);
    const payload = await response.json();
    applyManualActuals(payload.records || {});
  } catch (error) {
    console.warn("Coach invoices could not load.", error);
  }
}

async function saveCoachInvoices(options = {}) {
  if (!options.skipConfirm && !window.DashboardUI?.confirmSave("Save coach invoices for this club and period?")) return;
  const club = options.club || coachInvoiceClub.value;
  const value = options.value ?? Number(coachInvoicesPaid.value || 0);
  const statusElement = options.statusElement || coachInvoicesStatus;
  const button = options.button || coachInvoicesForm.querySelector("button");
  const originalText = button.textContent;
  const period = fitnessData.periods.find((item) => item.id === state.period);
  button.disabled = true;
  button.textContent = "Saving...";
  statusElement.textContent = "Saving coach invoices...";

  try {
    const response = await apiFetch("/api/fitness-manual-actuals", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        period: state.period,
        periodLabel: period?.label || state.period,
        periodRange: period?.range || "",
        club,
        coachInvoicesPaid: Number(value || 0)
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorText(payload.error || `HTTP ${response.status}`));
    applyManualActuals(payload.records || {});
    render();
    coachInvoicesStatus.textContent = `Coach invoices saved for ${club}.`;
    const savedButton = document.querySelector(`[data-save-coach-invoice="${CSS.escape(club)}"]`);
    if (options.club && savedButton) savedButton.textContent = "Saved";
  } catch (error) {
    statusElement.textContent = errorText(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderTargetInput(kpi, value) {
  const step = kpi.type === "percent" ? "0.1" : "1";
  const suffix = kpi.type === "percent" ? "%" : "";
  const prefix = kpi.type === "money" ? "$" : "";
  return `
    <label class="target-input-card">
      <span>${escapeHtml(kpi.label)}</span>
      <div class="target-input-shell">
        ${prefix ? `<b>${prefix}</b>` : ""}
        <input
          type="number"
          min="0"
          step="${step}"
          name="${escapeHtml(kpi.key)}"
          value="${Number(value || 0)}"
          inputmode="decimal"
          required
        >
        ${suffix ? `<b>${suffix}</b>` : ""}
      </div>
      <small>${kpi.key === "totalClassCapacity" ? "Manual entry" : kpi.target === "maximum" ? "Maximum" : kpi.target === "reference" ? "Budget reference" : "Minimum"}</small>
    </label>
  `;
}

function applySavedTargets(targetsByClub = {}) {
  savedTargetsByClub = targetsByClub || {};
  fitnessData.rows = fitnessData.rows.map((item) => {
    const targets = {
      ...(item.targets || {}),
      ...(savedTargetsByClub[item.club] || {})
    };
    if (targets.classCostBudget !== undefined) {
      item.actuals.classCostBudget = Number(targets.classCostBudget) || 0;
    }
    if (targets.totalClassCapacity !== undefined) {
      item.actuals.totalClassCapacity = Number(targets.totalClassCapacity) || 0;
    }
    item.actuals.classParticipationRatio = utilisationRatio(
      item.actuals.totalClassAttendance,
      item.actuals.totalClassCapacity
    );
    return { ...item, targets };
  });
}

function selectedTargetValues() {
  const formData = new FormData(fitnessTargetsForm);
  const values = {};
  for (const kpi of allKpis) {
    const raw = formData.get(kpi.key);
    values[kpi.key] = raw === null || raw === "" ? 0 : Number(raw);
  }
  return values;
}

async function loadFitnessTargets() {
  try {
    const response = await apiFetch("/api/fitness-targets", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Fitness targets returned ${response.status}`);
    const payload = await response.json();
    applySavedTargets(payload.targets || {});
  } catch (error) {
    console.warn("Fitness targets could not load.", error);
  }
}

async function saveFitnessTargets() {
  if (!window.DashboardUI?.confirmSave("Save fitness targets for this club? This updates the targets used on the scorecard.")) return;
  const button = fitnessTargetsForm.querySelector("button");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Saving...";
  fitnessTargetsStatus.textContent = "Saving Fitness KPI targets...";

  try {
    const response = await apiFetch("/api/fitness-targets", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        club: targetClub.value,
        targets: selectedTargetValues()
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorText(payload.error || `HTTP ${response.status}`));
    applySavedTargets(payload.targets || {});
    render();
    fitnessTargetsStatus.textContent = `Targets saved for ${targetClub.value}.`;
  } catch (error) {
    fitnessTargetsStatus.textContent = errorText(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function severity(item) {
  if (!item.target) return 99;
  if (item.status === "red") return 0;
  if (item.status === "amber") return 1;
  return 2;
}

function clubFocus(item) {
  const stored = String(item.focus || "");
  if (/pack sales are below target/i.test(stored)) {
    return "Check-ins are loaded. PT packs, PT revenue, class spend, recruitment and audits show No data where Hapana did not return a figure or nothing has been entered.";
  }
  return stored.replace(/Sept/g, "Sep");
}

function renderAttentionPanel() {
  const rows = currentRows();
  const items = [];
  const reds = rows.filter((item) => clubStatus(item) === "red");
  if (reds.length) items.push({ tone: "bad", text: `${reds.map((item) => item.club).join(", ")} ${reds.length === 1 ? "has" : "have"} a red KPI with data entered. Blank PT, invoice and SLA figures are marked No data instead of red.` });
  else if (rows.length) items.push({ tone: "watch", text: "No entered KPI is red for this selection. Figures with no source data are marked No data." });
  window.DashboardUI?.renderAttention(items);
}

function render() {
  renderSource();
  renderMetrics();
  renderPeriod();
  renderScorecard();
  renderParticipation();
  renderPtRevenue();
  renderRentCosts();
  renderRecruitment();
  renderCoachCompliance();
  renderSlaCompliance();
  renderSlaEditor();
  renderCoachInvoicesEditor();
  renderTargetsEditor();
  renderActions();
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
  logFitnessDashboardView();
}

clubFilter.addEventListener("change", () => {
  syncClubSelection();
  render();
  logFitnessDashboardView();
});

fitnessRefreshForm.addEventListener("submit", (event) => {
  event.preventDefault();
  refreshFitnessMetrics();
});

fitnessTargetsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveFitnessTargets();
});

coachInvoicesForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCoachInvoices();
});

coachInvoiceClub.addEventListener("change", () => {
  renderCoachInvoicesEditor();
  coachInvoicesStatus.textContent = "";
});

document.querySelector("#rentCostsBody").addEventListener("click", (event) => {
  const button = event.target.closest("[data-save-coach-invoice]");
  if (!button) return;
  const club = button.dataset.saveCoachInvoice;
  const input = document.querySelector(`[data-coach-invoice-input="${CSS.escape(club)}"]`);
  saveCoachInvoices({ club, value: Number(input?.value || 0), button });
});

targetClub.addEventListener("change", () => {
  renderTargetsEditor();
  fitnessTargetsStatus.textContent = "";
});

slaTrackingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveFitnessSla();
});

slaClub.addEventListener("change", () => {
  renderSlaEditor();
  slaTrackingStatus.textContent = "";
});

periodFilter.addEventListener("change", async () => {
  await handlePeriodChange();
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

function logFitnessDashboardView() {
  window.dashboardAuth?.logView?.({
    page: "Fitness",
    view: state.view,
    club: selectedClubLabel()
  });
}

async function loadFitnessData() {
  try {
    const response = await apiFetch("/api/fitness-metrics?stored=1", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Fitness metrics returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.rows)) throw new Error("Fitness metrics returned invalid rows");
    const kpiGroups = payload.kpiGroups?.length ? payload.kpiGroups : fitnessData.kpiGroups;
    fitnessData = {
      ...fitnessData,
      ...payload,
      rows: payload.rows.map(normaliseFitnessRow),
      periods: payload.periods?.length ? payload.periods : fitnessData.periods,
      clubs: payload.clubs?.length ? payload.clubs : fitnessData.clubs,
      kpiGroups: normaliseKpiGroups(kpiGroups)
    };
    allKpis = fitnessData.kpiGroups.flatMap((group) => group.kpis);
    state.period = fitnessData.periods[0]?.id || state.period;
    await loadFitnessTargets();
    await loadManualActuals();
    await loadFitnessSla();
    if (payload.rows.length) {
      state.connection = "live";
      return;
    }
    state.connection = "empty";
  } catch (error) {
    console.warn("Fitness metrics could not load.", error);
    state.connection = "fallback";
  }
}

async function refreshFitnessMetrics() {
  if (showLocalFitnessNotice()) return;
  const button = fitnessRefreshForm.querySelector("button");
  const originalText = button.textContent;
  button.disabled = true;

  try {
    fitnessRefreshStatus.textContent = "Updating Fitness KPIs from Core Hapana...";
    const params = new URLSearchParams({
      all: "1",
      date_from: toHapanaDate(window.DashboardUI.readDateInput(fitnessDateFrom)),
      date_to: toHapanaDate(window.DashboardUI.readDateInput(fitnessDateTo)),
      period_mode: "custom"
    });
    const response = await apiFetch(`/api/fitness-metrics?${params.toString()}`, {
      headers: { "Accept": "application/json" }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) {
      throw new Error(errorText(body.error || body || `HTTP ${response.status}`));
    }
    const failures = Array.isArray(body.failures)
      ? body.failures.map((item) => `${item.club || "Club"}: ${errorText(item.error)}`)
      : [];

    fitnessRefreshStatus.textContent = "Fitness data updated. Refreshing dashboard...";
    await loadFitnessData();
    initControls();
    render();
    fitnessRefreshStatus.textContent = failures.length
      ? `Finished with issues: ${failures.join(" | ")}`
      : "Fitness data updated.";
  } catch (error) {
    fitnessRefreshStatus.textContent = errorText(error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function handlePeriodChange() {
  const value = periodFilter.value;
  if (value.startsWith("stored:")) {
    state.period = value.slice("stored:".length);
    render();
    logFitnessDashboardView();
    return;
  }

  if (!value.startsWith("range:")) return;
  const [, mode, dateFrom, dateTo] = value.split(":");
  await loadFitnessRange(mode, dateFrom, dateTo);
}

async function loadFitnessRange(mode, dateFrom, dateTo) {
  if (showLocalFitnessNotice()) return;
  const originalValue = periodFilter.value;
  periodFilter.disabled = true;
  fitnessRefreshStatus.textContent = `Loading ${periodLabelForMode(mode)} from Hapana...`;

  try {
    const params = new URLSearchParams({
      all: "1",
      date_from: toHapanaDate(dateFrom),
      date_to: toHapanaDate(dateTo),
      period_mode: mode
    });
    const response = await apiFetch(`/api/fitness-metrics?${params.toString()}`, {
      headers: { "Accept": "application/json" }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) {
      throw new Error(errorText(body.error || body || `HTTP ${response.status}`));
    }
    const selectedPeriod = periodIdFromResponse(body, mode, toHapanaDate(dateFrom), toHapanaDate(dateTo));
    await loadFitnessData();
    if (selectedPeriod) state.period = selectedPeriod;
    initControls();
    render();
    fitnessRefreshStatus.textContent = `${periodLabelForMode(mode)} loaded.`;
  } catch (error) {
    fitnessRefreshStatus.textContent = errorText(error);
    periodFilter.value = originalValue;
  } finally {
    periodFilter.disabled = false;
  }
}

function periodIdFromResponse(payload, mode, dateFrom, dateTo) {
  const match = payload.periods?.find((period) =>
    period.periodMode === mode && period.dateFrom === dateFrom && period.dateTo === dateTo
  );
  if (match?.id) return match.id;
  const row = payload.rows?.find((item) =>
    item.periodMode === mode && item.dateFrom === dateFrom && item.dateTo === dateTo
  );
  return row?.period || payload.periods?.[0]?.id || "";
}

function periodLabelForMode(mode) {
  return {
    mtd: "month to date",
    month: "month",
    week: "week ending",
    custom: "custom period"
  }[mode] || "period";
}

function latestWeekInputs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceThursday = (today.getDay() - 4 + 7) % 7;
  const latestAvailableThursday = addDays(today, -daysSinceThursday);
  const end = addDays(latestAvailableThursday, -4);
  const start = addDays(end, -6);
  return {
    dateFrom: formatInputDate(start),
    dateTo: formatInputDate(end)
  };
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

function inputDateFromHapana(value) {
  const [day, month, year] = String(value || "").split("/");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function showLocalFitnessNotice() {
  if (window.location.protocol !== "file:") return false;
  fitnessRefreshStatus.replaceChildren(document.createTextNode(
    "Live refresh is unavailable when this dashboard is opened as a local file. Open the "
  ));
  const link = document.createElement("a");
  link.href = "https://ufcgym-dashboard-june2026.vercel.app/fitness.html";
  link.textContent = "hosted Fitness dashboard";
  fitnessRefreshStatus.append(link, document.createTextNode(" and sign in to update Hapana data."));
  return true;
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
    window.DashboardUI?.showStatus("Loading fitness data…");
    await window.dashboardAuth?.ready;
    await loadFitnessData();
    await loadFitnessSla();
    initControls();
    await syncFitnessDatesWithDdWeek();
    window.DashboardUI?.enhanceDateInputs(document);
    window.DashboardUI?.installClubFilter(clubFilter);
    syncClubSelection();
    render();
    document.body.classList.remove("dashboard-pending");
    window.DashboardUI?.hideStatus();
    showLocalFitnessNotice();
    logFitnessDashboardView();
  } catch (error) {
    document.body.classList.remove("dashboard-pending");
    window.DashboardUI?.showStatus(errorText(error), "error");
  }
}

init();
