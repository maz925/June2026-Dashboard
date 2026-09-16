const accessForm = document.querySelector("#logAccessForm");
const secretInput = document.querySelector("#logSecret");
const accessStatus = document.querySelector("#logAccessStatus");
const logStatus = document.querySelector("#logStatus");
const logRows = document.querySelector("#logRows");

const storedSecret = sessionStorage.getItem("ufcgym_view_log_secret") || "";
const urlSecret = new URLSearchParams(window.location.search).get("secret") || "";
secretInput.value = urlSecret || storedSecret;

if (secretInput.value) {
  loadLogs(secretInput.value);
}

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadLogs(secretInput.value.trim());
});

async function loadLogs(secret) {
  if (!secret) {
    setStatus("Enter the view-log secret.", true);
    return;
  }

  setStatus("Loading view log...");
  logRows.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

  try {
    const response = await fetch("/api/view-log", {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${secret}`
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `View log returned ${response.status}`);

    sessionStorage.setItem("ufcgym_view_log_secret", secret);
    renderLogs(payload.logs || []);
    setStatus(`Loaded ${(payload.logs || []).length} log entries.`);
    logStatus.textContent = "View log loaded";
  } catch (error) {
    logRows.innerHTML = `<tr><td colspan="7">View log could not load.</td></tr>`;
    setStatus(error.message || "View log could not load.", true);
    logStatus.textContent = "Access denied";
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
