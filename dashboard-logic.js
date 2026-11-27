(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DashboardLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CLUB_ORDER = ["Bankstown", "Wetherill Park", "580G", "Woolooware"];
  const CLUB_LOCATIONS = {
    Bankstown: "UFC GYM Bankstown",
    "Wetherill Park": "UFC GYM Wetherill Park",
    "580G": "580G",
    Woolooware: "UFC GYM Woolooware"
  };

  function has(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function assessPerformance(row) {
    const revenue = has(row.ddActual) || has(row.posActual);
    const ddKnown = has(row.ddGap) && has(row.ddTarget);
    const posKnown = has(row.posPercent) && has(row.targetPercent);
    const missed = [];
    if (revenue && ddKnown && Number(row.ddGap) < 0) missed.push("DD");
    if (revenue && posKnown && Number(row.posPercent) < Number(row.targetPercent)) missed.push("POS");
    const status = revenue && ddKnown && posKnown ? (missed.length ? "RED" : "GREEN") : (row.status || "PENDING");
    return {
      status,
      missed,
      badge: status === "RED" && missed.length ? `RED · ${missed.join(" & ")}` : status,
      aboveStretch: has(row.stretchPOSPercent) && has(row.posPercent) && Number(row.posPercent) >= Number(row.stretchPOSPercent),
      gapLabel: "DD Gap vs Realistic"
    };
  }

  function stretchBelowBaseline(dynamic, fixed) {
    if (!dynamic || !fixed) return false;
    return has(dynamic.stretchDDTarget) && has(fixed.ddTarget) && Number(dynamic.stretchDDTarget) < Number(fixed.ddTarget);
  }

  function parseDayMonthYear(value) {
    const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  }

  function formatDay(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(date).replace(/Sept/g, "Sep");
  }

  function formatRange(start, end) {
    if (!start || !end) return "";
    const left = formatDay(start).replace(/ \d{4}$/, "");
    const right = formatDay(end);
    return start.getUTCFullYear() === end.getUTCFullYear() ? `${left} to ${right}` : `${formatDay(start)} to ${right}`;
  }

  function monthLabel(date) {
    return new Intl.DateTimeFormat("en-AU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(date).replace(/Sept/g, "Sep");
  }

  function presentPeriods(periods) {
    const seen = new Set();
    const presented = [];
    for (const period of periods || []) {
      const start = parseDayMonthYear(period.dateFrom);
      const end = parseDayMonthYear(period.dateTo);
      const days = start && end ? Math.round((end - start) / 86400000) + 1 : null;
      const key = period.dateFrom && period.dateTo ? `${period.dateFrom}|${period.dateTo}` : "";
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      let label = String(period.label || period.range || period.id || "Period").replace(/Sept/g, "Sep");
      if (days === 1) label = formatDay(end);
      else if (days >= 28 && days <= 31) label = monthLabel(start);
      else if (days > 8) label = formatRange(start, end);
      else if (days >= 6 && days <= 8) label = `Week ending ${formatDay(end)}`;
      else label = label.replace(/^Custom\s+/i, "").replace(/\s*\([^)]*\)\s*$/, "");
      presented.push({ ...period, days, label });
    }
    return presented;
  }

  function productDisplay(name) {
    const text = String(name || "").replace(/\s+/g, " ").trim();
    const parts = text.split(/\)\s+(?=[A-Z])/).map((part, index, all) => {
      if (index < all.length - 1 && !part.endsWith(")")) return `${part})`;
      return part.trim();
    }).filter(Boolean);
    return { name: parts.join(" + "), joined: parts.length > 1 };
  }

  function rangesOverlap(left, right) {
    const a0 = parseDayMonthYear(left.dateFrom);
    const a1 = parseDayMonthYear(left.dateTo);
    const b0 = parseDayMonthYear(right.dateFrom);
    const b1 = parseDayMonthYear(right.dateTo);
    if (!a0 || !a1 || !b0 || !b1) return false;
    return a0 <= b1 && b0 <= a1;
  }

  function suspiciousWeeks(rows) {
    const byClub = new Map();
    for (const row of rows || []) {
      if (!byClub.has(row.club)) byClub.set(row.club, []);
      byClub.get(row.club).push(row);
    }
    const notes = [];
    for (const [club, clubRows] of byClub) {
      const positive = clubRows.map((row) => Number(row.ddActual) || 0).filter((value) => value > 0).sort((a, b) => a - b);
      const median = positive.length ? positive[Math.floor((positive.length - 1) / 2)] : 0;
      for (const row of clubRows) {
        const dd = Number(row.ddActual) || 0;
        const preOpen = club === "Woolooware" && String(row.weekEnding || "") < "2025-06-01" && dd < 1000;
        const low = median > 0 && dd < median * 0.4;
        if (!low && !preOpen) continue;
        const overlap = clubRows.some((other) => other !== row && rangesOverlap(row, other));
        let reason = "Far below this club's typical direct debit week. Check whether the Hapana export was incomplete.";
        if (preOpen) reason = "Before Woolooware opened in June 2025, so this is not a trading week.";
        else if (overlap) reason = "Overlaps another stored week and is far below the club's usual direct debit. This looks like an incomplete Hapana pull, not a trading collapse.";
        notes.push({ club, weekEnding: row.weekEnding, reason });
      }
    }
    return notes;
  }

  function orderClubs(names) {
    return [...names].sort((a, b) => {
      const ai = a === "All Clubs" ? -1 : CLUB_ORDER.indexOf(a);
      const bi = b === "All Clubs" ? -1 : CLUB_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || String(a).localeCompare(String(b));
    });
  }

  return {
    CLUB_ORDER,
    CLUB_LOCATIONS,
    assessPerformance,
    stretchBelowBaseline,
    presentPeriods,
    productDisplay,
    suspiciousWeeks,
    orderClubs,
    formatDay,
    formatRange,
    parseDayMonthYear
  };
});
