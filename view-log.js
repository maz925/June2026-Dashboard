const viewLogForm = document.querySelector("#viewLogForm");
const viewLogSecret = document.querySelector("#viewLogSecret");
const viewLogStatus = document.querySelector("#viewLogStatus");
const viewLogBody = document.querySelector("#viewLogBody");
const dateTime = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short"
});

viewLogForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  viewLogStatus.textContent = "Loading views...";
  viewLogBody.innerHTML = "";

  try {
    const response = await fetch(`/api/view-log?secret=${encodeURIComponent(viewLogSecret.value)}`, {
      headers: { "Accept": "application/json" }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);

    const logs = Array.isArray(body.logs) ? body.logs : [];
    viewLogStatus.textContent = logs.length ? `${logs.length} recent view(s) loaded.` : "No views have been logged yet.";
    viewLogBody.innerHTML = logs.map((row) => `
      <tr>
        <td>${escapeHtml(formatTime(row.timestamp))}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${escapeHtml(row.page)}</td>
        <td>${escapeHtml(row.view)}</td>
        <td>${escapeHtml(row.club)}</td>
      </tr>
    `).join("");
  } catch (error) {
    viewLogStatus.textContent = error.message || "Could not load views.";
  }
});

function formatTime(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed);
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
