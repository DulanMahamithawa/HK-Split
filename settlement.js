(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HKSplitCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function splitExpenseCents(amountCents, beneficiaries) {
    if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("Expense must use non-negative integer cents.");
    if (!beneficiaries.length) throw new Error("An expense needs at least one beneficiary.");
    const shares = new Map();
    const base = Math.floor(amountCents / beneficiaries.length);
    let remainder = amountCents % beneficiaries.length;
    beneficiaries.forEach((name) => {
      shares.set(name, base + (remainder > 0 ? 1 : 0));
      remainder -= remainder > 0 ? 1 : 0;
    });
    return shares;
  }

  function calculateSettlements(participants, expenses, idFactory = () => crypto.randomUUID()) {
    const balances = new Map(participants.map((name) => [name, 0]));

    expenses.forEach((expense) => {
      const amountCents = Math.round(Number(expense.amount) * 100);
      const excluded = new Set(expense.exclusions || []);
      const beneficiaries = participants.filter((name) => !excluded.has(name));
      if (!beneficiaries.length) throw new Error(`“${expense.note}” excludes everyone.`);
      if (!balances.has(expense.payer)) throw new Error(`${expense.payer} is not in this case.`);
      balances.set(expense.payer, balances.get(expense.payer) + amountCents);
      splitExpenseCents(amountCents, beneficiaries).forEach((share, name) => {
        balances.set(name, balances.get(name) - share);
      });
    });

    const creditors = [...balances]
      .filter(([, balance]) => balance > 0)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    const debtors = [...balances]
      .filter(([, balance]) => balance < 0)
      .map(([name, amount]) => ({ name, amount: -amount }))
      .sort((a, b) => b.amount - a.amount);

    const settlements = [];
    let creditorIndex = 0;
    let debtorIndex = 0;
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      const amount = Math.min(creditor.amount, debtor.amount);
      settlements.push({ id: idFactory(), from: debtor.name, to: creditor.name, amount_cents: amount, settled: false });
      creditor.amount -= amount;
      debtor.amount -= amount;
      if (creditor.amount === 0) creditorIndex += 1;
      if (debtor.amount === 0) debtorIndex += 1;
    }
    return settlements;
  }

  return { splitExpenseCents, calculateSettlements };
});
