const reloadButton = document.querySelector("#reloadLogButton");
const accessStatus = document.querySelector("#logAccessStatus");
const logStatus = document.querySelector("#logStatus");
const logRows = document.querySelector("#logRows");

init();

reloadButton.addEventListener("click", () => loadLogs());

async function init() {
  setStatus("Waiting for Google sign-in...");
  const profile = await window.dashboardAuth?.ready;
  if (!profile) {
    setStatus("Google sign-in is required to view logs.", true);
    logStatus.textContent = "Sign-in required";
    return;
  }
  loadLogs();
}

async function loadLogs() {
  const credential = sessionStorage.getItem("ufcgym_google_credential") || "";
  if (!credential) {
    setStatus("Google sign-in is required to view logs.", true);
    logStatus.textContent = "Sign-in required";
    return;
  }

  setStatus("Loading view log...");
  reloadButton.disabled = true;
  logRows.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

  try {
    const response = await fetch("/api/view-log", {
      headers: {
        "Accept": "application/json",
        "X-Google-Credential": credential
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `View log returned ${response.status}`);

    renderLogs(payload.logs || []);
    setStatus(`Loaded ${(payload.logs || []).length} log entries.`);
    logStatus.textContent = "View log loaded";
  } catch (error) {
    logRows.innerHTML = `<tr><td colspan="7">View log could not load.</td></tr>`;
    setStatus(error.message || "View log could not load.", true);
    logStatus.textContent = "Access denied";
  } finally {
    reloadButton.disabled = false;
  }
}

function renderLogs(logs) {
  if (!logs.length) {
    logRows.innerHTML = `<tr><td colspan="7">No log entries stored yet.</td></tr>`;
    return;
  }

  logRows.innerHTML = logs.map((entry) => `
    <tr>
      <td>${escapeHtml(formatDate(entry.timestamp))}</td>
      <td>${escapeHtml(entry.name || "")}</td>
      <td>${escapeHtml(entry.email || "")}</td>
      <td>${escapeHtml(entry.page || "")}</td>
      <td>${escapeHtml(entry.view || "")}</td>
      <td>${escapeHtml(entry.club || "")}</td>
      <td>${escapeHtml(entry.ip || "")}</td>
    </tr>
  `).join("");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney"
  }).format(date);
}

function setStatus(message, isError = false) {
  accessStatus.textContent = message;
  accessStatus.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}
