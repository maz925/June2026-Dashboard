const test = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../dashboard-logic.js");

test("status names the target that was missed and does not call a beat stretch a miss", () => {
  const wetherill = logic.assessPerformance({
    ddActual: 21000,
    ddTarget: 19099.75,
    ddGap: 1900,
    posPercent: 14.4,
    targetPercent: 8,
    stretchPOSPercent: 13.6
  });
  assert.equal(wetherill.status, "GREEN");
  assert.equal(wetherill.aboveStretch, true);
  assert.deepEqual(wetherill.missed, []);

  const bankstown = logic.assessPerformance({
    ddActual: 24959,
    ddTarget: 23186,
    ddGap: 1773,
    posPercent: 6,
    targetPercent: 8.3,
    stretchPOSPercent: 16.3
  });
  assert.equal(bankstown.status, "RED");
  assert.deepEqual(bankstown.missed, ["POS"]);
  assert.equal(bankstown.badge, "RED · POS");

  const both = logic.assessPerformance({
    ddActual: 100,
    ddTarget: 200,
    ddGap: -100,
    posPercent: 2,
    targetPercent: 8
  });
  assert.equal(both.badge, "RED · DD & POS");
});

test("stretch below baseline is reported without changing the stored numbers", () => {
  assert.equal(logic.stretchBelowBaseline(
    { stretchDDTarget: 19807.15 },
    { ddTarget: 20000 }
  ), true);
  assert.equal(logic.stretchBelowBaseline(
    { stretchDDTarget: 24045 },
    { ddTarget: 22000 }
  ), false);
});

test("period labels drop duplicate ranges and do not call a month a week", () => {
  const periods = logic.presentPeriods([
    { id: "a", label: "Week ending 8 Nov 2026", range: "2 Nov 2026 to 8 Nov 2026", dateFrom: "02/11/2026", dateTo: "08/11/2026", periodMode: "week" },
    { id: "b", label: "Custom 2 Nov 2026 to 8 Nov 2026", range: "2 Nov 2026 to 8 Nov 2026", dateFrom: "02/11/2026", dateTo: "08/11/2026", periodMode: "custom" },
    { id: "2026-08-31", label: "Week ending 31 Aug 2026", range: "1 Aug 2026 to 31 Aug 2026", dateFrom: "01/08/2026", dateTo: "31/08/2026" },
    { id: "c", label: "Custom 21 Sept 2026 to 4 Oct 2026", range: "21 Sept 2026 to 4 Oct 2026", dateFrom: "21/09/2026", dateTo: "04/10/2026" }
  ]);
  assert.equal(periods.length, 3);
  assert.equal(periods[0].label, "Week ending 8 Nov 2026");
  assert.equal(periods[1].label, "August 2026");
  assert.equal(periods[2].label, "21 Sep to 4 Oct 2026");
});

test("joined POS names are marked and a single fee name is left intact", () => {
  const joined = logic.productDisplay("Casual Adult 18+ Years (Casual Adult 18+ Years) Protein Shakes - Ultimate (Heel Hook)");
  assert.equal(joined.joined, true);
  assert.match(joined.name, /Casual Adult 18\+ Years \(Casual Adult 18\+ Years\) \+ Protein Shakes/);
  const fee = logic.productDisplay("Admin Fee (Admin Fee $75)");
  assert.equal(fee.joined, false);
  assert.equal(fee.name, "Admin Fee (Admin Fee $75)");
});

test("near-zero overlapping August weeks are annotated and pre-opening Woolooware is separate", () => {
  const notes = logic.suspiciousWeeks([
    { club: "Wetherill Park", weekEnding: "2026-07-30", dateFrom: "24/07/2026", dateTo: "30/07/2026", ddActual: 16383 },
    { club: "Wetherill Park", weekEnding: "2026-08-06", dateFrom: "31/07/2026", dateTo: "06/08/2026", ddActual: 2686 },
    { club: "Wetherill Park", weekEnding: "2026-08-09", dateFrom: "03/08/2026", dateTo: "09/08/2026", ddActual: 14420 },
    { club: "580G", weekEnding: "2026-07-16", dateFrom: "10/07/2026", dateTo: "16/07/2026", ddActual: 12089 },
    { club: "580G", weekEnding: "2026-07-23", dateFrom: "17/07/2026", dateTo: "23/07/2026", ddActual: 11426 },
    { club: "580G", weekEnding: "2026-07-30", dateFrom: "24/07/2026", dateTo: "30/07/2026", ddActual: 12216 },
    { club: "580G", weekEnding: "2026-08-06", dateFrom: "31/07/2026", dateTo: "06/08/2026", ddActual: 1945 },
    { club: "580G", weekEnding: "2026-08-09", dateFrom: "03/08/2026", dateTo: "09/08/2026", ddActual: 1695 },
    { club: "580G", weekEnding: "2026-08-16", dateFrom: "10/08/2026", dateTo: "16/08/2026", ddActual: 22390 },
    { club: "Woolooware", weekEnding: "2025-01-16", dateFrom: "10/01/2025", dateTo: "16/01/2025", ddActual: 0 },
    { club: "Woolooware", weekEnding: "2026-08-16", dateFrom: "10/08/2026", dateTo: "16/08/2026", ddActual: 10556 }
  ]);
  const flagged = notes.map((note) => `${note.club} ${note.weekEnding}`);
  assert.ok(flagged.includes("Wetherill Park 2026-08-06"));
  assert.ok(!flagged.includes("Wetherill Park 2026-08-09"));
  assert.ok(flagged.includes("580G 2026-08-06"));
  assert.ok(flagged.includes("580G 2026-08-09"));
  assert.match(notes.find((note) => note.club === "Woolooware").reason, /June 2025/);
});
