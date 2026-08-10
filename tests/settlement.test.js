"use strict";

const assert = require("node:assert/strict");
const { calculateSettlements, splitExpenseCents } = require("../settlement.js");

let nextId = 0;
const idFactory = () => `test-${++nextId}`;

function normalized(lines) {
  return lines.map(({ from, to, amount_cents }) => ({ from, to, amount_cents }));
}

// Exact cents are conserved when a value cannot divide evenly.
const uneven = splitExpenseCents(10000, ["A", "B", "C"]);
assert.equal([...uneven.values()].reduce((sum, value) => sum + value, 0), 10000);
assert.deepEqual([...uneven.values()], [3334, 3333, 3333]);

// The example: Udula's drinks exclude Umali; his fuel applies to all.
assert.deepEqual(normalized(calculateSettlements(
  ["Kasuni", "Udula", "Umali"],
  [
    { payer: "Udula", amount: 4000, note: "Drinks", exclusions: ["Umali"] },
    { payer: "Udula", amount: 2000, note: "Fuel", exclusions: [] },
    { payer: "Kasuni", amount: 3000, note: "Pizza", exclusions: [] },
  ],
  idFactory,
)), [
  { from: "Umali", to: "Udula", amount_cents: 166666 },
  { from: "Kasuni", to: "Udula", amount_cents: 66667 },
]);

// Mutual expenses are netted into one simplified payment.
assert.deepEqual(normalized(calculateSettlements(
  ["A", "B"],
  [
    { payer: "A", amount: 1000, note: "Dinner", exclusions: [] },
    { payer: "B", amount: 400, note: "Taxi", exclusions: [] },
  ],
  idFactory,
)), [{ from: "B", to: "A", amount_cents: 30000 }]);

// Exact contributions produce no debt lines.
assert.deepEqual(calculateSettlements(
  ["A", "B"],
  [
    { payer: "A", amount: 100, note: "A share", exclusions: ["B"] },
    { payer: "B", amount: 100, note: "B share", exclusions: ["A"] },
  ],
  idFactory,
), []);

assert.throws(() => calculateSettlements(
  ["A", "B"],
  [{ payer: "A", amount: 100, note: "Nobody", exclusions: ["A", "B"] }],
  idFactory,
), /excludes everyone/);

console.log("Settlement tests passed");
