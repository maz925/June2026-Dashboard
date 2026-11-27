(() => {
  const logic = window.DashboardLogic;
  const STORAGE_KEY = "ufcgym-clubs";
  const DEFINITIONS = {
    dd: "Direct debit: membership revenue collected for the reporting period.",
    pos: "Point of sale: non-membership sales such as food, merchandise, fees and other till items.",
    "pos-percent": "POS % is POS revenue divided by DD revenue.",
    nmm: "NMM means net member movement: new member profiles created in the period, minus paid cancellations in the same period.",
    utilisation: "Utilisation is class attendance divided by class capacity.",
    realistic: "The DD gap and the red/green status use the Realistic DD target and the Realistic POS % target.",
    packages: "Package counts are membership packages sold or active. One person can hold more than one package, so this is not the same as a count of people.",
    "paid-cancellations": "Paid cancellations are revenue-impacting memberships with a cancel date from the 1st of the month through the as-at date. ARMA and $0 packages are excluded.",
    "scheduled-cancellations": "Scheduled cancellations count memberships whose cancel date falls anywhere in the calendar month, including dates after the as-at day. It is not the same measure as paid cancellations.",
    "export-rows": "Export rows are the membership lines Hapana returned. They are not a member count.",
    "new-profiles": "New memberships here are member profiles whose created date falls in the period. A package sold to someone who joined earlier is not included."
  };

  const ui = {
    fetch: authFetch,
    whenAuthorised,
    paintFreshness,
    installClubFilter,
    refreshClubFilter,
    enhanceDateInputs,
    readDateInput,
    setDateInput,
    renderAttention,
    confirmSave,
    selectedClubs,
    orderClubs: logic.orderClubs,
    locationForClub,
    showStatus,
    hideStatus,
    formatAuDate,
    bindDefinitions
  };
  window.DashboardUI = ui;
  bindDefinitions(document);

  async function whenAuthorised() {
    if (window.dashboardAuth?.ready) await window.dashboardAuth.ready;
  }

  function authFetch(url, options = {}) {
    if (window.dashboardAuth?.fetch) return window.dashboardAuth.fetch(url, options);
    return fetch(url, options);
  }

  function showStatus(message, kind = "loading") {
    const node = document.querySelector("#pageStatus");
    if (!node) return;
    node.hidden = false;
    node.className = `page-status ${kind}`;
    node.textContent = message;
  }

  function hideStatus() {
    const node = document.querySelector("#pageStatus");
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
  }

  function paintFreshness(updated, version) {
    const node = document.querySelector("#updatedAt");
    const parsed = parseUpdated(updated);
    const when = parsed
      ? `${formatSydney(parsed)} (Sydney time)`
      : (updated ? String(updated) : "Unknown");
    if (node) {
      node.textContent = "";
      const label = document.createElement("span");
      label.textContent = `Data as at ${when}`;
      label.title = version ? `Build ${version}` : "";
      node.appendChild(label);
      if (parsed && Date.now() - parsed.getTime() > 7 * 24 * 60 * 60 * 1000) {
        const warning = document.createElement("strong");
        warning.className = "stale-warning";
        warning.textContent = "Data is more than 7 days old";
        node.appendChild(warning);
      }
    }
    let foot = document.querySelector("#buildStamp");
    if (!foot) {
      foot = document.createElement("p");
      foot.id = "buildStamp";
      foot.className = "build-stamp";
      document.body.appendChild(foot);
    }
    foot.textContent = version ? `Build ${version}` : "";
    foot.title = version || "";
    return { stale: Boolean(parsed && Date.now() - parsed.getTime() > 7 * 24 * 60 * 60 * 1000), parsed };
  }

  function parseUpdated(value) {
    if (!value) return null;
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!match) return null;
    const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4] || "00"}:${match[5] || "00"}:00+11:00`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatSydney(date) {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date).replace(/Sept/g, "Sep");
  }

  function formatAuDate(date) {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date).replace(/Sept/g, "Sep");
  }

  function installClubFilter(select) {
    if (!select || select.dataset.enhanced === "1") return;
    select.dataset.enhanced = "1";
    select.classList.add("club-select-native");
    reorderOptions(select);
    const saved = readSavedClubs().filter((value) => [...select.options].some((option) => option.value === value));
    if (saved.length) {
      const useAll = saved.includes("All Clubs");
      [...select.options].forEach((option) => {
        option.selected = useAll ? option.value === "All Clubs" : saved.includes(option.value);
      });
    }
    const bar = document.createElement("div");
    bar.className = "club-chips";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Clubs");
    select.before(bar);
    const paint = () => {
      const selected = selectedClubs(select);
      bar.innerHTML = [...select.options].map((option) => {
        const on = selected.includes(option.value);
        const title = logic.CLUB_LOCATIONS[option.value] || option.value;
        return `<button type="button" class="club-chip${on ? " is-on" : ""}" data-club="${escapeAttr(option.value)}" aria-pressed="${on}" title="${escapeAttr(title)}">${escapeHtml(option.textContent)}</button>`;
      }).join("");
      paintFilterNote(selected);
      const location = document.querySelector("#reportLocation");
      if (location && selected.length === 1 && selected[0] !== "All Clubs") {
        const wanted = locationForClub(selected[0]);
        if ([...location.options].some((option) => option.value === wanted)) location.value = wanted;
      }
    };
    bar.addEventListener("click", (event) => {
      const button = event.target.closest(".club-chip");
      if (!button) return;
      const value = button.dataset.club;
      const current = selectedClubs(select);
      let next;
      if (value === "All Clubs") next = ["All Clubs"];
      else {
        const withoutAll = current.filter((item) => item !== "All Clubs");
        next = withoutAll.includes(value) ? withoutAll.filter((item) => item !== value) : withoutAll.concat(value);
        if (!next.length) next = ["All Clubs"];
      }
      [...select.options].forEach((option) => {
        option.selected = next.includes(option.value);
      });
      persistClubs(next);
      paint();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    select.addEventListener("change", () => {
      persistClubs(selectedClubs(select));
      paint();
    });
    select.paintClubChips = paint;
    paint();
  }

  function refreshClubFilter(select) {
    reorderOptions(select);
    if (select?.paintClubChips) select.paintClubChips();
  }

  function reorderOptions(select) {
    const options = [...select.options];
    options.sort((a, b) => logic.orderClubs([a.value, b.value])[0] === a.value ? -1 : 1);
    const ordered = logic.orderClubs(options.map((option) => option.value));
    ordered.forEach((value) => {
      const option = options.find((item) => item.value === value);
      if (!option) return;
      if (value === "580G" || /580\s*george/i.test(option.textContent)) option.textContent = "580G";
      select.appendChild(option);
    });
  }

  function selectedClubs(select) {
    const values = [...select.selectedOptions].map((option) => option.value);
    if (!values.length || values.includes("All Clubs")) return ["All Clubs"];
    return values;
  }

  function readSavedClubs() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("clubs");
    if (fromUrl) return fromUrl.split(",").map((item) => item.trim()).filter(Boolean);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  function persistClubs(values) {
    const all = !values.length || values.includes("All Clubs");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all ? ["All Clubs"] : values));
    const params = new URLSearchParams(window.location.search);
    if (all) params.delete("clubs");
    else params.set("clubs", values.join(","));
    const next = params.toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }

  function paintFilterNote(selected) {
    const note = document.querySelector("#filterNote");
    if (!note) return;
    const filtered = selected.filter((club) => club !== "All Clubs");
    note.hidden = !filtered.length;
    note.textContent = filtered.length ? `Filtered: ${filtered.join(", ")}` : "";
  }

  function locationForClub(club) {
    return logic.CLUB_LOCATIONS[club] || club;
  }

  function enhanceDateInputs(root = document) {
    root.querySelectorAll("input[type='date']").forEach((input) => {
      const iso = input.value;
      input.type = "text";
      input.placeholder = "DD/MM/YYYY";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.dataset.auDate = "1";
      input.title = "Date format DD/MM/YYYY";
      input.pattern = "\\d{1,2}/\\d{1,2}/\\d{4}";
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) input.value = isoToAu(iso);
    });
  }

  function readDateInput(input) {
    const value = String(input?.value || "").trim();
    const au = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (au) return `${au[3]}-${au[2].padStart(2, "0")}-${au[1].padStart(2, "0")}`;
    return value;
  }

  function setDateInput(input, iso) {
    if (!input) return;
    input.value = input.dataset.auDate === "1" ? isoToAu(iso) : iso;
  }

  function isoToAu(iso) {
    const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
  }

  function renderAttention(items) {
    const node = document.querySelector("#attention");
    if (!node) return;
    const rows = (items || []).filter(Boolean);
    node.hidden = !rows.length;
    node.innerHTML = rows.length ? `<h2>What needs attention</h2><ul>${rows.map((item) => `<li class="${escapeAttr(item.tone || "")}">${escapeHtml(item.text)}</li>`).join("")}</ul>` : "";
  }

  function confirmSave(message) {
    return window.confirm(message);
  }

  function bindDefinitions(root) {
    root.querySelectorAll("[data-define]").forEach((node) => {
      if (node.dataset.defineBound) return;
      node.dataset.defineBound = "1";
      const text = DEFINITIONS[node.dataset.define];
      if (!text) return;
      node.title = text;
      if (node.tagName === "BUTTON") return;
      node.classList.add("has-definition");
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
