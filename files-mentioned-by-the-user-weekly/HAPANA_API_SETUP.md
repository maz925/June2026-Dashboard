# Hapana API Setup

Do not put Hapana API keys in `index.html`, `app.js`, or any file published by GitHub Pages.

Use `hapana-worker.js` as a backend proxy, for example with Cloudflare Workers. The included `wrangler.toml` is a starter deployment config.

## Required Worker Secrets

- `HAPANA_API_KEY`: Hapana access key, stored as a secret. Paste the full access key value from Hapana.
- `HAPANA_BEARER_TOKEN`: Hapana bearer token, if using bearer auth instead.
- `HAPANA_AUTH_MODE`: optional. Set to `basic` only if Hapana confirms the access key must be sent as HTTP Basic auth. Leave unset for `X-Hapana-API-Key`.
- `CLUB_SITE_IDS`: optional JSON mapping of dashboard club names to Hapana site IDs. If omitted, the Worker tries to match active Hapana sites by name.
- `HAPANA_BASE_URL`: Hapana API base URL from the API docs. The current default is `https://api.hapana-app.com/v2`, but update this if Hapana docs show a different production URL.

Example `CLUB_SITE_IDS`:

```json
{
  "Wetherill Park": "site-id-here",
  "Bankstown": "site-id-here",
  "580G": "site-id-here",
  "Woolooware": "site-id-here"
}
```

## Connect The Dashboard

After the Worker is deployed, copy its URL into `index.html`:

```html
<script>
  window.HAPANA_PROXY_URL = "https://your-worker.your-account.workers.dev";
</script>
```

The dashboard will try live Hapana data first. If the proxy is not configured or unavailable, it falls back to the workbook data in `tracker-data.js`.

## Deploy With Cloudflare

Install Wrangler, log in, then deploy:

```powershell
npm install -g wrangler
wrangler login
wrangler secret put HAPANA_API_KEY
wrangler deploy
```

When prompted for `HAPANA_API_KEY`, paste the full Hapana access key.

If automatic site matching does not find the clubs, add `CLUB_SITE_IDS` too:

```powershell
wrangler secret put CLUB_SITE_IDS
```

When prompted, paste the JSON mapping of club names to Hapana site IDs.

## Notes

The current proxy uses Hapana `/payments` and expands the client object so each payment can be mapped to a club using `client.homeLocationId`. Confirm with Hapana whether DD/POS revenue should be classified by `paymentMethod`, `description`, or a specific metadata field.
