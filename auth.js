(() => {
  const credentialKey = "ufcgym_google_credential";
  const profileKey = "ufcgym_google_profile";
  const state = {
    config: { enabled: false },
    credential: sessionStorage.getItem(credentialKey) || "",
    profile: readProfile(),
    readyResolve: null,
    lastLogKey: "",
    lastLogAt: 0
  };

  const ready = initAuth();
  window.dashboardAuth = {
    ready,
    logView
  };

  async function initAuth() {
    state.config = await fetchAuthConfig();
    if (!state.config.enabled) return null;

    if (state.credential && state.profile && !isExpired(state.profile) && isAllowedProfile(state.profile)) {
      hideGate();
      return state.profile;
    }

    clearStoredCredential();
    return new Promise((resolve) => {
      state.readyResolve = resolve;
      showGate();
      waitForGoogle().then(renderGoogleButton).catch((error) => {
        showAuthError(error.message || "Google sign-in could not load");
      });
    });
  }

  async function logView(details = {}) {
    const profile = await ready;
    if (!profile || !state.credential) return;

    const payload = {
      credential: state.credential,
      page: details.page || document.title || "Dashboard",
      view: details.view || "",
      club: details.club || ""
    };
    const key = JSON.stringify(payload);
    const now = Date.now();
    if (key === state.lastLogKey && now - state.lastLogAt < 2000) return;
    state.lastLogKey = key;
    state.lastLogAt = now;

    try {
      await fetch("/api/view-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.warn("Dashboard view log failed.", error);
    }
  }

  async function fetchAuthConfig() {
    try {
      const response = await fetch("/api/auth-config", { headers: { "Accept": "application/json" } });
      if (!response.ok) return { enabled: false };
      return response.json();
    } catch (error) {
      console.warn("Auth config could not load.", error);
      return { enabled: false };
    }
  }

  function renderGoogleButton() {
    const target = document.querySelector("#googleSignInButton");
    if (!target || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: state.config.clientId,
      callback: handleGoogleCredential
    });
    window.google.accounts.id.renderButton(target, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 280
    });
  }

  function handleGoogleCredential(result) {
    const profile = parseJwt(result.credential);
    if (!isAllowedProfile(profile)) {
      clearStoredCredential();
      showAuthError(state.config.allowedDomain
        ? `Please sign in with a ${state.config.allowedDomain} Google account.`
        : "That Google account is not authorised.");
      return;
    }
    state.credential = result.credential;
    state.profile = profile;
    sessionStorage.setItem(credentialKey, result.credential);
    sessionStorage.setItem(profileKey, JSON.stringify(profile));
    hideGate();
    if (state.readyResolve) state.readyResolve(profile);
  }

  function showGate() {
    if (document.querySelector("#authGate")) return;
    const gate = document.createElement("div");
    gate.id = "authGate";
    gate.className = "auth-gate";
    gate.innerHTML = `
      <section class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <p class="auth-kicker">UFC GYM Dashboard</p>
        <h1 id="authTitle">Sign in to continue</h1>
        <p class="auth-note">${state.config.allowedDomain
          ? `Use your ${escapeHtml(state.config.allowedDomain)} Google account.`
          : "Use your authorised Google account."}</p>
        <div id="googleSignInButton" class="google-sign-in"></div>
        <p id="authError" class="auth-error" role="alert"></p>
      </section>
    `;
    document.body.appendChild(gate);
  }

  function hideGate() {
    document.querySelector("#authGate")?.remove();
  }

  function showAuthError(message) {
    const node = document.querySelector("#authError");
    if (node) node.textContent = message;
  }

  function waitForGoogle() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - started > 10000) {
          clearInterval(interval);
          reject(new Error("Google sign-in timed out"));
        }
      }, 100);
    });
  }

  function readProfile() {
    try {
      return JSON.parse(sessionStorage.getItem(profileKey) || "null");
    } catch (error) {
      return null;
    }
  }

  function clearStoredCredential() {
    state.credential = "";
    state.profile = null;
    sessionStorage.removeItem(credentialKey);
    sessionStorage.removeItem(profileKey);
  }

  function parseJwt(token) {
    const payload = token.split(".")[1] || "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = decodeURIComponent(atob(padded).split("").map((char) =>
      `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
    ).join(""));
    return JSON.parse(decoded);
  }

  function isExpired(profile) {
    return !profile.exp || profile.exp * 1000 < Date.now() + 60000;
  }

  function isAllowedProfile(profile) {
    const allowedDomain = String(state.config.allowedDomain || "").trim().toLowerCase();
    if (!allowedDomain) return true;
    const hostedDomain = String(profile.hd || "").toLowerCase();
    const email = String(profile.email || "").toLowerCase();
    return hostedDomain === allowedDomain || email.endsWith(`@${allowedDomain}`);
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
})();
