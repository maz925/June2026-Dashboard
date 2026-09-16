const FITNESS_APP_VERSION = "fitness-kpi-dashboard-v4-2026-09-16";

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
      title: "Class Participation Ratio",
      kpis: [
        { key: "totalCheckins", label: "Total Check-ins", type: "number", target: "minimum" },
        { key: "totalClassAttendance", label: "Total Class Attendance", type: "number", target: "minimum" },
        { key: "classParticipationRatio", label: "Class Participation Ratio", type: "percent", target: "minimum" }
      ]
    },
    {
      title: "PT Packs Sold / PT Sessions Split Revenue",
      kpis: [
        { key: "ptMmaPacksSold", label: "Number PT/MMA Packs Sold This Week", type: "number", target: "minimum" },
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
        { key: "paidClassCosts", label: "Total Paid Class Costs", type: "money", target: "maximum" },
        { key: "classCostBudget", label: "Budget", type: "money", target: "reference" }
      ]
    }
  ],
  rows: [
    row("2026-09", "Bankstown", [7120, 2645, 37.1, 22, 188, 18400, 12800, 9, 7200, 4200, 3300, 7500], [7600, 3000, 39, 26, 205, 21000, 14000, 10, 7800, 4100, 3100, 7200], "Lift class attendance from member check-ins and close the PT pack gap."),
    row("2026-09", "Wetherill Park", [7680, 3355, 43.7, 31, 232, 24600, 16400, 12, 9600, 4500, 3600, 8100], [7500, 3300, 42, 29, 225, 23500, 15800, 12, 9300, 4600, 3500, 8300], "Protect strong participation while keeping class costs under budget."),
    row("2026-09", "580G", [5840, 1920, 32.9, 17, 151, 14900, 9800, 7, 5600, 3600, 2900, 6500], [6200, 2300, 37, 22, 175, 18000, 12000, 8, 6400, 3500, 2800, 6200], "Rebuild class participation and PT pack sales this week."),
    row("2026-09", "Woolooware", [6410, 2440, 38.1, 24, 172, 17600, 11900, 8, 6800, 3900, 3100, 7000], [6600, 2550, 39, 25, 185, 19000, 12800, 9, 7000, 3900, 3000, 6900], "Near plan; watch sessions performed and paid class costs."),
    row("2026-08", "Bankstown", [22100, 8920, 40.4, 91, 646, 70200, 44600, 10, 29400, 15100, 11900, 27000], [21800, 8500, 39, 88, 640, 69000, 43000, 10, 28600, 15000, 11600, 26600], "August finished ahead on participation and PT revenue."),
    row("2026-08", "Wetherill Park", [23650, 10280, 43.5, 104, 702, 79200, 50700, 12, 37200, 16800, 13200, 30000], [23000, 9800, 42, 98, 680, 76000, 48000, 12, 36000, 16900, 13000, 29900], "Strong PT revenue and rent collection; costs slightly high."),
    row("2026-08", "580G", [18320, 6540, 35.7, 72, 498, 54800, 37300, 8, 22400, 12600, 10100, 22700], [19000, 7100, 37, 78, 535, 61000, 38000, 8, 24800, 12800, 10000, 22800], "PT revenue and participation were below target."),
    row("2026-08", "Woolooware", [19860, 7710, 38.8, 82, 552, 61300, 40000, 9, 26000, 14200, 10900, 25100], [20000, 7800, 39, 84, 560, 62000, 40000, 9, 26100, 14100, 10800, 24900], "Almost exactly on plan with a small class cost overrun."),
    row("2026-07", "Bankstown", [21450, 8200, 38.2, 84, 612, 66100, 45100, 10, 28200, 14900, 11100, 26000], [21600, 8300, 38.5, 86, 625, 67000, 45000, 10, 28300, 15000, 11200, 26200], "July was stable with minor participation and pack gaps."),
    row("2026-07", "Wetherill Park", [22680, 9530, 42, 96, 664, 73100, 48400, 12, 35100, 16000, 12800, 28800], [22400, 9300, 41.5, 94, 660, 72000, 48000, 12, 34800, 16100, 12700, 28800], "Healthy base across all major Fitness KPIs."),
    row("2026-07", "580G", [18840, 6820, 36.2, 76, 521, 58600, 37100, 8, 23600, 12400, 9900, 22300], [18800, 6900, 36.8, 77, 530, 59000, 38000, 8, 24000, 12600, 9900, 22500], "Close to plan; focus stayed on participation yield."),
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
const slaTrackingForm = document.querySelector("#slaTrackingForm");
const slaTrackingGrid = document.querySelector("#slaTrackingGrid");
const slaTrackingStatus = document.querySelector("#slaTrackingStatus");
const slaClub = document.querySelector("#slaClub");
let allKpis = fitnessData.kpiGroups.flatMap((group) => group.kpis);
let savedTargetsByClub = {};
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
      { key: "programmingCompliancePct", label: "Programming Compliance", type: "percent", target: 95, mode: "minimum" },
      { key: "certificationCompliancePct", label: "Coach Certification Compliance", type: "percent", target: 100, mode: "minimum" }
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
  actuals.classCostBudget = targetValues[12];
  targets.classCostBudget = targetValues[12];
  return { period, club, actuals, targets, focus };
}

function currentRows() {
  const rows = fitnessData.rows.filter((item) => item.period === state.period);
  return isAllClubsSelected() ? rows : rows.filter((item) => state.clubs.includes(item.club));
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

  totals.actuals.classParticipationRatio = totals.actuals.totalCheckins
    ? round1((totals.actuals.totalClassAttendance / totals.actuals.totalCheckins) * 100)
    : 0;
  totals.targets.classParticipationRatio = totals.targets.totalCheckins
    ? round1((totals.targets.totalClassAttendance / totals.targets.totalCheckins) * 100)
    : 0;
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
  const statuses = allKpis
    .filter((kpi) => kpi.target !== "reference")
    .map((kpi) => statusFor(item.actuals[kpi.key], item.targets[kpi.key], kpi.target));
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
  if (kpi.target === "maximum") return `Budget ${formatValue(target, kpi.type)}`;
  if (kpi.target === "reference") return "Reference budget";
  return `Target ${formatValue(target, kpi.type)}`;
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
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
  document.querySelector(selector).textContent = value;
}

function initControls() {
  const clubs = ["All Clubs", ...fitnessData.clubs];
  clubFilter.multiple = true;
  clubFilter.size = Math.min(5, clubs.length);
  clubFilter.innerHTML = clubs.map((club) => `<option value="${escapeHtml(club)}"${club === "All Clubs" ? " selected" : ""}>${escapeHtml(club)}</option>`).join("");
  periodFilter.innerHTML = periodOptionsHtml();
  periodFilter.value = `stored:${state.period}`;
  targetClub.innerHTML = fitnessData.clubs.map((club) => `<option value="${escapeHtml(club)}">${escapeHtml(club)}</option>`).join("");
  if (!targetClub.value) targetClub.value = fitnessData.clubs[0] || "";
  slaClub.innerHTML = fitnessData.clubs.map((club) => `<option value="${escapeHtml(club)}">${escapeHtml(club)}</option>`).join("");
  if (!slaClub.value) slaClub.value = fitnessData.clubs[0] || "";

  const dates = latestWeekInputs();
  fitnessDateFrom.value = dates.dateFrom;
  fitnessDateTo.value = dates.dateTo;
}

function syncClubSelection() {
  const values = [...clubFilter.selectedOptions].map((option) => option.value);
  state.clubs = !values.length || values.includes("All Clubs") ? ["All Clubs"] : values;
  [...clubFilter.options].forEach((option) => {
    option.selected = state.clubs.includes(option.value);
  });
}

function periodOptionsHtml() {
  const stored = fitnessData.periods.map((period) =>
    `<option value="stored:${escapeHtml(period.id)}">${escapeHtml(period.label)}${period.range ? ` (${escapeHtml(period.range)})` : ""}</option>`
  ).join("");
  const quickOptions = quickPeriodOptions();
  return `
    <optgroup label="Stored periods">${stored}</optgroup>
    <optgroup label="Month to date">
      ${quickOptions.mtd.map(renderRangeOption).join("")}
    </optgroup>
    <optgroup label="Months">
      ${quickOptions.months.map(renderRangeOption).join("")}
    </optgroup>
    <optgroup label="Week endings">
      ${quickOptions.weeks.map(renderRangeOption).join("")}
    </optgroup>
  `;
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
  setText("#updatedAt", fitnessData.updated
    ? `Prepared ${fitnessData.updated} | ${FITNESS_APP_VERSION}`
    : FITNESS_APP_VERSION);
}

function renderMetrics() {
  const rows = currentRows();
  const totals = visibleTotals();
  const statuses = allKpis
    .filter((kpi) => kpi.target !== "reference")
    .map((kpi) => statusFor(totals.actuals[kpi.key], totals.targets[kpi.key], kpi.target));
  const greenCount = statuses.filter((status) => status === "green").length;

  setText("#totalCheckins", formatValue(totals.actuals.totalCheckins, "number"));
  setText("#classAttendance", formatValue(totals.actuals.totalClassAttendance, "number"));
  setText("#participationRatio", formatValue(totals.actuals.classParticipationRatio, "percent"));
  setText("#ptPacksSold", formatValue(totals.actuals.ptMmaPacksSold, "number"));
  setText("#kpiHealth", rows.length ? `${greenCount}/${statuses.length}` : "0/0");
  setText("#slaComplianceMetric", `${formatValue(slaScoreForRows(currentSlaRows()), "percent")}`);
}

function renderPeriod() {
  const period = fitnessData.periods.find((item) => item.id === state.period);
  const focus = currentRows().find((item) => clubStatus(item) === "red")?.focus || "All selected clubs are tracking within range.";
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
        <p class="note">${escapeHtml(item.focus)}</p>
      </article>
    `;
  }).join("");
}

function renderKpi(item, kpi) {
  const actual = item.actuals[kpi.key] || 0;
  const target = kpi.key === "paidClassCosts" ? item.targets.classCostBudget : item.targets[kpi.key] || 0;
  const status = statusFor(actual, target, kpi.target);
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
          <span><span class="mini-label">Participation Ratio</span><strong class="mini-value">${formatValue(item.actuals.classParticipationRatio, "percent")}</strong></span>
          <span><span class="mini-label">Ratio Target</span><strong class="mini-value">${formatValue(item.targets.classParticipationRatio, "percent")}</strong></span>
        </div>
      </article>
    `;
  }).join("");
}

function renderTrend() {
  const container = document.querySelector("#fitnessTrend");
  const periods = [...fitnessData.periods].reverse();
  const values = periods.map((period) => {
    const totals = aggregateRows(fitnessData.rows.filter((item) =>
      item.period === period.id && (isAllClubsSelected() || state.clubs.includes(item.club))
    ));
    return totals.actuals.classParticipationRatio || 0;
  });
  const width = 980;
  const height = 320;
  const pad = { top: 22, right: 28, bottom: 54, left: 66 };
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
  const labels = periods.map((period, index) => `
    <text class="trend-label" x="${x(index)}" y="${height - 20}" text-anchor="middle">${escapeHtml(period.label.replace(" 2026", ""))}</text>
  `).join("");
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index)},${y(value)}`).join(" ");
  const dots = values.map((value, index) => `
    <circle class="trend-dot" cx="${x(index)}" cy="${y(value)}" r="4.2" fill="#c8112e">
      <title>${escapeHtml(periods[index].label)}: ${formatValue(value, "percent")}</title>
    </circle>
  `).join("");
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Class participation ratio trend line graph">
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
    const status = statusFor(item.actuals.ptMmaPacksSold, item.targets.ptMmaPacksSold);
    const totalRevenue = (item.actuals.posRevenue || 0) + (item.actuals.sessionSplitIncome || 0);
    return `
      <tr>
        <td>${escapeHtml(item.club)}</td>
        <td>${number.format(item.actuals.ptMmaPacksSold || 0)}</td>
        <td>${number.format(item.actuals.paidPtSessions || 0)}</td>
        <td>${money.format(item.actuals.posRevenue || 0)}</td>
        <td>${money.format(item.actuals.sessionSplitIncome || 0)}</td>
        <td>${money.format(totalRevenue)}</td>
        <td><span class="status ${status}">${statusText(status)}</span></td>
      </tr>
    `;
  }).join("");
}

function renderRentCosts() {
  const body = document.querySelector("#rentCostsBody");
  body.innerHTML = currentRows().map((item) => {
    const status = statusFor(item.actuals.paidClassCosts, item.targets.classCostBudget, "maximum");
    return `
      <tr>
        <td>${escapeHtml(item.club)}</td>
        <td>${number.format(item.actuals.activePts || 0)}</td>
        <td>${money.format(item.actuals.ptRentCollected || 0)}</td>
        <td>${money.format(item.actuals.conditioningClassCosts || 0)}</td>
        <td>${money.format(item.actuals.skillsClassCosts || 0)}</td>
        <td>${money.format(item.actuals.paidClassCosts || 0)}</td>
        <td>${money.format(item.targets.classCostBudget || 0)}</td>
        <td><span class="status ${status}">${statusText(status)}</span></td>
      </tr>
    `;
  }).join("");
}

function renderActions() {
  const container = document.querySelector("#fitnessActions");
  const actions = currentRows().flatMap((item) =>
    allKpis
      .filter((kpi) => kpi.target !== "reference")
      .map((kpi) => {
        const target = kpi.key === "paidClassCosts" ? item.targets.classCostBudget : item.targets[kpi.key];
        return {
          club: item.club,
          kpi,
          actual: item.actuals[kpi.key] || 0,
          target: target || 0,
          status: statusFor(item.actuals[kpi.key], target, kpi.target),
          focus: item.focus
        };
      })
      .filter((action) => action.status !== "green")
  ).sort((a, b) => severity(a) - severity(b));

  if (!actions.length) {
    container.innerHTML = `<article class="club-card"><p class="note">No under-target Fitness KPIs for the current selection.</p></article>`;
    return;
  }

  container.innerHTML = actions.map((item) => {
    const gap = item.kpi.target === "maximum" ? item.actual - item.target : item.target - item.actual;
    const label = item.kpi.target === "maximum" ? "over budget" : "gap";
    return `
      <article class="action-card">
        <div>
          <span class="status ${item.status}">${statusText(item.status)}</span>
          <h3>${escapeHtml(item.club)}: ${escapeHtml(item.kpi.label)}</h3>
          <p>${escapeHtml(item.focus)}</p>
        </div>
        <strong>${formatValue(Math.max(0, gap), item.kpi.type)} ${label}</strong>
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
  if (!value && value !== 0) return "pending";
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
  if (!statuses.length) return 0;
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
    const score = slaScoreForRows([row]);
    const status = score >= 90 ? "green" : score >= 75 ? "amber" : "red";
    return `
      <article class="club-card">
        <div class="card-head">
          <span class="club-name">${escapeHtml(row.club)}</span>
          <span class="status ${status}">${statusText(status)}</span>
        </div>
        <div class="mini-grid">
          <span><span class="mini-label">SLA Compliance</span><strong class="mini-value">${formatValue(score, "percent")}</strong></span>
          <span><span class="mini-label">Recruitment</span><strong class="mini-value">${formatValue(slaScoreForRows([row], slaGroups[0].fields), "percent")}</strong></span>
          <span><span class="mini-label">Audits & Training</span><strong class="mini-value">${formatValue(slaScoreForRows([row], slaGroups[1].fields), "percent")}</strong></span>
          <span><span class="mini-label">Reporting</span><strong class="mini-value">${formatValue(slaScoreForRows([row], slaGroups[2].fields), "percent")}</strong></span>
        </div>
      </article>
    `;
  }).join("");
}

function renderSlaClubCard(row, fields) {
  const score = slaScoreForRows([row], fields);
  const status = score >= 90 ? "green" : score >= 75 ? "amber" : "red";
  return `
    <article class="club-card">
      <div class="card-head">
        <span class="club-name">${escapeHtml(row.club)}</span>
        <span class="status ${status}">${statusText(status)}</span>
      </div>
      <div class="sla-item-grid">
        ${fields.map((field) => renderSlaMini(row, field)).join("")}
      </div>
    </article>
  `;
}

function renderSlaMini(row, field) {
  const value = row.actuals[field.key] || 0;
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
    const response = await fetch("/api/fitness-sla", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Fitness SLA tracking returned ${response.status}`);
    const payload = await response.json();
    slaRecords = payload.records || {};
  } catch (error) {
    console.warn("Fitness SLA tracking could not load.", error);
  }
}

async function saveFitnessSla() {
  const button = slaTrackingForm.querySelector("button");
  const originalText = button.textContent;
  const period = fitnessData.periods.find((item) => item.id === state.period) || {};
  button.disabled = true;
  button.textContent = "Saving...";
  slaTrackingStatus.textContent = "Saving SLA tracking...";

  try {
    const response = await fetch("/api/fitness-sla", {
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
      <small>${kpi.target === "maximum" ? "Maximum" : kpi.target === "reference" ? "Budget reference" : "Minimum"}</small>
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
    const response = await fetch("/api/fitness-targets", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Fitness targets returned ${response.status}`);
    const payload = await response.json();
    applySavedTargets(payload.targets || {});
  } catch (error) {
    console.warn("Fitness targets could not load.", error);
  }
}

async function saveFitnessTargets() {
  const button = fitnessTargetsForm.querySelector("button");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Saving...";
  fitnessTargetsStatus.textContent = "Saving Fitness KPI targets...";

  try {
    const response = await fetch("/api/fitness-targets", {
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
  renderTargetsEditor();
  renderActions();
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
    const response = await fetch("/api/fitness-metrics?stored=1", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Fitness metrics returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.rows)) throw new Error("Fitness metrics returned invalid rows");
    fitnessData = {
      ...fitnessData,
      ...payload,
      periods: payload.periods?.length ? payload.periods : fitnessData.periods,
      clubs: payload.clubs?.length ? payload.clubs : fitnessData.clubs,
      kpiGroups: payload.kpiGroups?.length ? payload.kpiGroups : fitnessData.kpiGroups
    };
    allKpis = fitnessData.kpiGroups.flatMap((group) => group.kpis);
    state.period = fitnessData.periods[0]?.id || state.period;
    await loadFitnessTargets();
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
  const button = fitnessRefreshForm.querySelector("button");
  const originalText = button.textContent;
  button.disabled = true;

  try {
    fitnessRefreshStatus.textContent = "Updating Fitness KPIs from Core Hapana...";
    const params = new URLSearchParams({
      all: "1",
      date_from: toHapanaDate(fitnessDateFrom.value),
      date_to: toHapanaDate(fitnessDateTo.value),
      period_mode: "custom"
    });
    const response = await fetch(`/api/fitness-metrics?${params.toString()}`, {
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
    const response = await fetch(`/api/fitness-metrics?${params.toString()}`, {
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

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
  await loadFitnessData();
  await loadFitnessSla();
  initControls();
  render();
  window.dashboardAuth?.ready?.then(logFitnessDashboardView);
}

init();
