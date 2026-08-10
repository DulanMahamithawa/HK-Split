"use strict";

const SUPABASE_URL = "https://tartuagksloztboeeqxm.supabase.co";
const SUPABASE_KEY = "sb_publishable_w88K5iyGF4VhjYEkT33DkA_eJDNeoh_";
const FRIENDS = ["Bhagya", "Buddhi", "Dulan", "Kasuni", "Shirantha", "Udula", "Umali"];
const POLL_INTERVAL = 10000;
const { calculateSettlements } = HKSplitCore;

const state = {
  cases: [],
  bankDetails: Object.fromEntries(FRIENDS.map((name) => [name, ""])),
  currentTab: "active",
  busy: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  activeCases: $("#activeCases"),
  closedCases: $("#closedCases"),
  activeCount: $("#activeCount"),
  closedCount: $("#closedCount"),
  bankCards: $("#bankCards"),
  caseModal: $("#caseModal"),
  caseForm: $("#caseForm"),
  caseTitle: $("#caseTitle"),
  caseDate: $("#caseDate"),
  participantPicker: $("#participantPicker"),
  expenseRows: $("#expenseRows"),
  expenseTemplate: $("#expenseTemplate"),
  caseError: $("#caseError"),
  confirmModal: $("#confirmModal"),
  confirmTitle: $("#confirmTitle"),
  confirmMessage: $("#confirmMessage"),
  confirmButton: $("#confirmButton"),
  syncStatus: $("#syncStatus"),
  toast: $("#toast"),
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function displayDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-LK", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function setSync(kind, label) {
  els.syncStatus.className = `sync-status ${kind ? `is-${kind}` : ""}`;
  els.syncStatus.innerHTML = `<span class="sync-dot"></span><span>${escapeHtml(label)}</span>`;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      detail = body.message || body.hint || detail;
    } catch (_) { /* response was not JSON */ }
    throw new Error(detail);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadData({ quiet = false } = {}) {
  if (state.busy) return;
  if (!quiet) setSync("", "Syncing…");
  try {
    const [friends, cases] = await Promise.all([
      api("hk_friends?select=name,bank_details&order=name.asc"),
      api("hk_cases?select=*&order=created_at.desc"),
    ]);
    FRIENDS.forEach((name) => { state.bankDetails[name] = ""; });
    friends.forEach((friend) => { state.bankDetails[friend.name] = friend.bank_details || ""; });
    state.cases = cases;
    render();
    setSync("online", "Live & synced");
  } catch (error) {
    console.error(error);
    setSync("error", "Setup needed");
    if (!quiet) toast("Database setup is needed — see README");
  }
}

function personCheck(name, checked = true, className = "") {
  return `<label class="person-check ${className}">
    <input type="checkbox" value="${escapeHtml(name)}" ${checked ? "checked" : ""}>
    <span>${escapeHtml(name)}</span>
  </label>`;
}

function resetCaseForm() {
  els.caseForm.reset();
  els.caseDate.value = new Date().toISOString().slice(0, 10);
  els.caseError.textContent = "";
  els.participantPicker.innerHTML = FRIENDS.map((name) => personCheck(name)).join("");
  els.expenseRows.innerHTML = "";
  addExpenseRow();
}

function selectedParticipants() {
  return $$("input:checked", els.participantPicker).map((input) => input.value);
}

function addExpenseRow(prefill = {}) {
  const fragment = els.expenseTemplate.content.cloneNode(true);
  const row = $(".expense-row", fragment);
  row.dataset.id = prefill.id || crypto.randomUUID();
  els.expenseRows.appendChild(fragment);
  refreshExpenseRows();
  const added = els.expenseRows.lastElementChild;
  if (prefill.payer) $(".expense-payer", added).value = prefill.payer;
  if (prefill.amount) $(".expense-amount", added).value = prefill.amount;
  if (prefill.note) $(".expense-note", added).value = prefill.note;
}

function refreshExpenseRows() {
  const participants = selectedParticipants();
  $$(".expense-row", els.expenseRows).forEach((row, index) => {
    $(".record-number", row).textContent = `Record ${index + 1}`;
    const payer = $(".expense-payer", row);
    const previousPayer = payer.value;
    payer.innerHTML = `<option value="">Choose a friend</option>${participants.map((name) => `<option>${escapeHtml(name)}</option>`).join("")}`;
    if (participants.includes(previousPayer)) payer.value = previousPayer;

    const exclusionWrap = $(".expense-exclusions", row);
    const previousExclusions = new Set($$("input:checked", exclusionWrap).map((input) => input.value));
    exclusionWrap.innerHTML = participants.map((name) => personCheck(name, previousExclusions.has(name), "exclusion-check")).join("");
    $$("input", exclusionWrap).forEach((input) => {
      input.checked = previousExclusions.has(input.value);
    });
  });
}

function readExpenses() {
  return $$(".expense-row", els.expenseRows).map((row) => ({
    id: row.dataset.id,
    payer: $(".expense-payer", row).value,
    amount: Number($(".expense-amount", row).value),
    note: $(".expense-note", row).value.trim(),
    exclusions: $$(".expense-exclusions input:checked", row).map((input) => input.value),
  }));
}

function validateCase(participants, expenses) {
  if (!els.caseTitle.value.trim()) return "Give this case a name.";
  if (!els.caseDate.value) return "Choose a date.";
  if (participants.length < 2) return "Choose at least two people.";
  if (!expenses.length) return "Add at least one contribution record.";
  for (const [index, expense] of expenses.entries()) {
    if (!participants.includes(expense.payer)) return `Choose who paid record ${index + 1}.`;
    if (!Number.isFinite(expense.amount) || expense.amount <= 0) return `Enter a valid amount for record ${index + 1}.`;
    if (!expense.note) return `Add a note for record ${index + 1}.`;
    if (expense.exclusions.length >= participants.length) return `Record ${index + 1} cannot exclude everyone.`;
  }
  return "";
}

async function createCase(event) {
  event.preventDefault();
  const participants = selectedParticipants();
  const expenses = readExpenses();
  const error = validateCase(participants, expenses);
  if (error) {
    els.caseError.textContent = error;
    return;
  }

  let settlements;
  try {
    settlements = calculateSettlements(participants, expenses);
  } catch (calculationError) {
    els.caseError.textContent = calculationError.message;
    return;
  }

  state.busy = true;
  setSync("", "Saving…");
  try {
    await api("hk_cases", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        title: els.caseTitle.value.trim(),
        case_date: els.caseDate.value,
        participants,
        expenses,
        settlements,
        status: "active",
      }),
    });
    els.caseModal.close();
    toast("Case created and split calculated");
  } catch (saveError) {
    els.caseError.textContent = saveError.message;
    setSync("error", "Save failed");
  } finally {
    state.busy = false;
    await loadData();
  }
}

async function toggleSettlement(caseId, settlementId) {
  const currentCase = state.cases.find((item) => item.id === caseId);
  if (!currentCase) return;
  const settlements = currentCase.settlements.map((line) => line.id === settlementId ? { ...line, settled: !line.settled } : line);
  await updateCase(caseId, { settlements }, settlements.find((line) => line.id === settlementId)?.settled ? "Payment marked as done" : "Payment reopened");
}

async function updateCase(caseId, updates, message) {
  state.busy = true;
  setSync("", "Saving…");
  try {
    await api(`hk_cases?id=eq.${encodeURIComponent(caseId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
    });
    toast(message);
  } catch (error) {
    toast(`Could not save: ${error.message}`);
    setSync("error", "Save failed");
  } finally {
    state.busy = false;
    await loadData();
  }
}

function closeCase(caseId) {
  const currentCase = state.cases.find((item) => item.id === caseId);
  if (!currentCase) return;
  if (currentCase.settlements.some((line) => !line.settled)) {
    toast("Finish every payment line first");
    return;
  }
  confirmAction({
    title: "Close this case?",
    message: `${currentCase.title} will move to Closed cases. You can still view its full breakdown.`,
    button: "Close case",
    danger: false,
    onConfirm: () => updateCase(caseId, { status: "closed" }, "Case closed — all settled"),
  });
}

function deleteCase(caseId) {
  const currentCase = state.cases.find((item) => item.id === caseId && item.status === "closed");
  if (!currentCase) return;
  confirmAction({
    title: "Delete this case?",
    message: `${currentCase.title} and its contribution history will be permanently removed.`,
    button: "Delete permanently",
    danger: true,
    onConfirm: async () => {
      state.busy = true;
      try {
        await api(`hk_cases?id=eq.${encodeURIComponent(caseId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        toast("Closed case deleted");
      } catch (error) {
        toast(`Could not delete: ${error.message}`);
      } finally {
        state.busy = false;
        await loadData();
      }
    },
  });
}

function confirmAction({ title, message, button, danger, onConfirm }) {
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  els.confirmButton.textContent = button;
  els.confirmButton.className = `button ${danger ? "button-danger" : "button-primary"}`;
  els.confirmButton.onclick = () => {
    els.confirmModal.close();
    onConfirm();
  };
  els.confirmModal.showModal();
}

async function saveBankDetails(name, card) {
  const textarea = $("textarea", card);
  const button = $("button", card);
  button.disabled = true;
  try {
    await api("hk_friends?on_conflict=name", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ name, bank_details: textarea.value.trim(), updated_at: new Date().toISOString() }),
    });
    state.bankDetails[name] = textarea.value.trim();
    toast(`${name}’s details saved`);
    setSync("online", "Live & synced");
  } catch (error) {
    toast(`Could not save: ${error.message}`);
    setSync("error", "Save failed");
  } finally {
    button.disabled = false;
  }
}

function renderCase(currentCase) {
  const expenses = Array.isArray(currentCase.expenses) ? currentCase.expenses : [];
  const settlements = Array.isArray(currentCase.settlements) ? currentCase.settlements : [];
  const totalCents = expenses.reduce((sum, expense) => sum + Math.round(Number(expense.amount) * 100), 0);
  const paidCount = settlements.filter((line) => line.settled).length;
  const isClosed = currentCase.status === "closed";
  const canClose = settlements.every((line) => line.settled);

  const settlementHtml = settlements.length ? settlements.map((line) => `
    <div class="settlement-line ${line.settled ? "is-paid" : ""}">
      <div class="settlement-copy">
        <strong>${escapeHtml(line.from)}</strong> pays <strong>${escapeHtml(line.to)}</strong>
        <span class="settlement-amount">${money(line.amount_cents)}</span>
      </div>
      ${isClosed ? `<span class="status-pill closed">Paid</span>` : `<button class="paid-toggle ${line.settled ? "is-paid" : ""}" type="button" data-action="toggle-payment" data-case="${currentCase.id}" data-settlement="${line.id}">${line.settled ? "✓ Paid" : "Mark paid"}</button>`}
    </div>`).join("") : `<div class="settlement-line"><div class="settlement-copy"><strong>Nothing to pay</strong><br>Everyone contributed their exact share.</div></div>`;

  const contributionHtml = expenses.map((expense) => `
    <div class="contribution-line">
      <div class="contribution-top"><strong>${escapeHtml(expense.payer)}</strong><strong>${money(Math.round(Number(expense.amount) * 100))}</strong></div>
      <div class="contribution-note">${escapeHtml(expense.note)}</div>
      ${(expense.exclusions || []).length ? `<div class="exclusion-note">Excluded: ${expense.exclusions.map(escapeHtml).join(", ")}</div>` : ""}
    </div>`).join("");

  return `<article class="case-card">
    <div class="case-summary">
      <div>
        <div class="case-title-row"><h3 class="case-title">${escapeHtml(currentCase.title)}</h3><span class="status-pill ${isClosed ? "closed" : ""}">${isClosed ? "Closed" : "Active"}</span></div>
        <p class="case-meta">${displayDate(currentCase.case_date)} · ${currentCase.participants.map(escapeHtml).join(", ")}</p>
      </div>
      <div class="case-total"><span>Total spent</span><strong>${money(totalCents)}</strong></div>
    </div>
    <div class="case-body">
      <div><h4 class="subheading">Who pays whom</h4><div class="settlement-list">${settlementHtml}</div></div>
      <div><h4 class="subheading">Contributions</h4><div class="contribution-list">${contributionHtml}</div></div>
    </div>
    <div class="case-footer">
      <p>${settlements.length ? `${paidCount} of ${settlements.length} payment lines complete` : "No payment lines needed"}</p>
      ${isClosed
        ? `<button class="button button-ghost button-small danger-text" type="button" data-action="delete-case" data-case="${currentCase.id}">Delete case</button>`
        : `<button class="button button-primary button-small" type="button" data-action="close-case" data-case="${currentCase.id}" ${canClose ? "" : "disabled"}>Close case</button>`}
    </div>
  </article>`;
}

function emptyState(kind) {
  const closed = kind === "closed";
  return `<div class="empty-state">
    <div class="empty-icon">${closed ? "✓" : "↗"}</div>
    <h3>${closed ? "No closed cases yet" : "Everything is settled"}</h3>
    <p>${closed ? "Finished trips and hangouts will stay here until you choose to delete them." : "Start a case after your next trip or hangout and we’ll work out the cleanest way to settle up."}</p>
    ${closed ? "" : `<button class="button button-secondary" type="button" data-action="open-case-modal">＋ New case</button>`}
  </div>`;
}

function renderBankCards() {
  els.bankCards.innerHTML = FRIENDS.map((name) => `<article class="bank-card" data-name="${escapeHtml(name)}">
    <div class="bank-card-header"><div class="avatar">${initials(name)}</div><h3>${escapeHtml(name)}</h3></div>
    <label>Account information
      <textarea maxlength="500" placeholder="Bank, branch, account name and number…">${escapeHtml(state.bankDetails[name])}</textarea>
    </label>
    <div class="bank-card-actions"><button class="button button-secondary button-small" type="button" data-action="save-bank" data-name="${escapeHtml(name)}">Save details</button></div>
  </article>`).join("");
}

function render() {
  const active = state.cases.filter((item) => item.status === "active");
  const closed = state.cases.filter((item) => item.status === "closed");
  els.activeCount.textContent = active.length;
  els.closedCount.textContent = closed.length;
  els.activeCases.innerHTML = active.length ? active.map(renderCase).join("") : emptyState("active");
  els.closedCases.innerHTML = closed.length ? closed.map(renderCase).join("") : emptyState("closed");
  renderBankCards();
}

function switchTab(tab) {
  state.currentTab = tab;
  $$(".tab").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
  $$('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== tab; });
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-case-modal") {
    resetCaseForm();
    els.caseModal.showModal();
  } else if (action === "close-case-modal") {
    els.caseModal.close();
  } else if (action === "add-expense") {
    addExpenseRow();
  } else if (action === "remove-expense") {
    target.closest(".expense-row").remove();
    if (!els.expenseRows.children.length) addExpenseRow();
    refreshExpenseRows();
  } else if (action === "toggle-payment") {
    toggleSettlement(target.dataset.case, target.dataset.settlement);
  } else if (action === "close-case") {
    closeCase(target.dataset.case);
  } else if (action === "delete-case") {
    deleteCase(target.dataset.case);
  } else if (action === "save-bank") {
    saveBankDetails(target.dataset.name, target.closest(".bank-card"));
  } else if (action === "cancel-confirm") {
    els.confirmModal.close();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.closest("#participantPicker")) refreshExpenseRows();
});

$$('[data-tab]').forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
els.caseForm.addEventListener("submit", createCase);

render();
loadData();
setInterval(() => loadData({ quiet: true }), POLL_INTERVAL);
