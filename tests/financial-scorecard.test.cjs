const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function helpers(rows) {
  const source = fs.readFileSync('app.js', 'utf8');
  const context = { data: { rolling: rows }, isCompleteRevenueWeek: (row) => row.complete !== false };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function financialWeekTotals('), source.indexOf('function renderFinancialComparison(')), context);
  return context;
}

test('financial totals use matching clubs and week, accept zero and reject missing data', () => {
  const context = helpers([
    { weekEnding: '2026-10-18', club: 'A', ddActual: 100, posActual: 25 },
    { weekEnding: '2026-10-18', club: 'B', ddActual: 200, posActual: 50 },
    { weekEnding: '2026-10-11', club: 'A', ddActual: 80, posActual: 20 },
    { weekEnding: '2026-10-04', club: 'A', ddActual: 0, posActual: 0 },
    { weekEnding: '2026-09-27', club: 'A', ddActual: 100 },
    { weekEnding: '2026-09-20', club: 'A', ddActual: 100, posActual: 50, complete: false }
  ]);
  const totals = context.financialWeekTotals('2026-10-18', ['A', 'B']);
  assert.equal(totals.revenue, 375);
  assert.equal(totals.posPercent, 25);
  assert.equal(context.financialWeekTotals('2026-10-18', ['A']).revenue, 125);
  assert.equal(context.financialWeekTotals('2026-10-11', ['A', 'B']), null);
  assert.equal(context.financialWeekTotals('2026-10-04', ['A']).revenue, 0);
  assert.equal(context.financialWeekTotals('2026-10-04', ['A']).posPercent, null);
  assert.equal(context.financialWeekTotals('2026-09-27', ['A']), null);
  assert.equal(context.financialWeekTotals('2026-09-20', ['A']), null);
});

test('financial changes handle increases, decreases, zero baseline and unavailable values', () => {
  const { financialChange } = helpers([]);
  assert.equal(financialChange(125, 100).percent, 25);
  assert.equal(financialChange(75, 100).difference, -25);
  assert.equal(financialChange(100, 100).percent, 0);
  assert.equal(financialChange(100, 0).percent, null);
  assert.equal(financialChange(undefined, 100), null);
  assert.equal(financialChange(100, null), null);
});
