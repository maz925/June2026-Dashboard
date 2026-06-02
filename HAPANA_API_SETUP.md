# Hapana API Setup

Do not put Hapana API keys in `index.html`, `app.js`, or any file published by GitHub Pages.

Use `hapana-worker.js` as a backend proxy, for example with Cloudflare Workers. The included `wrangler.toml` is a starter deployment config.

## Required Worker Secrets

- `HAPANA_ACCESS_ID`: Hapana Public API access key. Use the full colon-separated value from the API docs portal.
- `CLUB_SITE_IDS`: JSON mapping of dashboard club names to Hapana site IDs.

Example `CLUB_SITE_IDS`:

```json
{
  "Wetherill Park": "UWNnS2tUM3VDeUN0YTlaWlBDM3lqdz09",
  "Bankstown": "Z0R6ZkxvWThJWGxEeUxnd2UyY2tKdz09",
  "580G": "QTBOOHBBZDRFL3F5QjNBcTJaZHdxUT09",
  "Woolooware": "RTM4ZWdHWjNnVUdPeXl4TDlmWVFVUT09"
}
```

## Connect The Dashboard

Copy `config.example.js` to `config.js`, then set the deployed Worker URL:

```powershell
Copy-Item config.example.js config.js
```

```js
window.HAPANA_PROXY_URL = "https://your-worker.your-account.workers.dev";
```

`config.js` is ignored by git so the deployed URL can be changed locally without editing the dashboard code. The dashboard will try live Hapana data first. If the proxy is not configured or unavailable, it falls back to the workbook data in `tracker-data.js`.

## Deploy With Cloudflare

Install Wrangler, log in, then deploy:

```powershell
npm install -g wrangler
wrangler login
wrangler secret put HAPANA_ACCESS_ID
wrangler secret put CLUB_SITE_IDS
wrangler deploy
```

When prompted for `CLUB_SITE_IDS`, paste the JSON mapping of club names to Hapana site IDs.

## Optional Worker Vars

- `HAPANA_BASE_URL`: Defaults to `https://api.hapana.com/v2`.
- `HAPANA_PUBLIC_API_ONLY`: Defaults to `true`. The documented Public API exposes sites, clients, packages, sessions, and per-client purchases, but not a site-level DD/POS payment feed.
- `HAPANA_PAYMENTS_PATH`: Reserved for a future Hapana payment-ledger endpoint.
- `HAPANA_AMOUNT_IS_CENTS`: Reserved for a future payment-ledger endpoint.
- `HAPANA_MAX_PAGES`: Defaults to `20`.

## Find Site IDs

After deploying the Worker and setting `HAPANA_ACCESS_ID`, open:

```text
https://your-worker.your-account.workers.dev/sites
```

Use the returned `id` values to set `CLUB_SITE_IDS`.

## Notes

The active Hapana Public API docs use `https://api.hapana.com/v2` with an `accessID` header. The current documented endpoints do not expose a site-level DD/POS payment feed. Until Hapana provides that revenue endpoint, the dashboard can confirm Hapana connectivity and keep using workbook revenue.
