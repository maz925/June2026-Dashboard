# Deploy to Vercel

This project can be deployed as a static dashboard with one Vercel serverless API route.

## 1. Import the Project

1. Push this folder to GitHub.
2. In Vercel, choose **Add New > Project**.
3. Import the GitHub repo.
4. Leave the framework preset as **Other** if Vercel does not detect one.

## 2. Add Environment Variables

In the Vercel project, open **Settings > Environment Variables** and add:

```text
HAPANA_ACCESS_ID
```

Use the full colon-separated Hapana Public API access key as the value.

Optional:

```text
HAPANA_BASE_URL=https://api.hapana.com/v2
```

For the legacy Core report downloader, also add:

```text
HAPANA_CORE_EMAIL
HAPANA_CORE_PASSWORD
```

These are the login credentials for `https://core.hapana.com`. Do not add them to `config.js`, `index.html`, or any GitHub file.

For Google sign-in and view logging, add:

```text
GOOGLE_CLIENT_ID
GOOGLE_ALLOWED_DOMAIN
VIEW_LOG_SECRET
BLOB_READ_WRITE_TOKEN
```

`GOOGLE_ALLOWED_DOMAIN` is optional. Set it only if sign-in should be restricted to one Google Workspace domain.

## 3. Register the Google OAuth Origin

If Google shows `Error 400: origin_mismatch`, the deployed dashboard URL is missing from the OAuth client.

1. Open the Google Cloud Console project that owns `GOOGLE_CLIENT_ID`.
2. Go to **APIs & Services > Credentials**.
3. Open the OAuth 2.0 Client ID used by this dashboard.
4. Under **Authorised JavaScript origins**, add the dashboard origin exactly, with no trailing slash or path.

Examples:

```text
https://your-dashboard.vercel.app
https://dashboard.yourdomain.com
http://localhost:4173
```

After saving, redeploy or refresh the dashboard and try Google sign-in again.

You can confirm the origin the app is using by opening:

```text
https://your-dashboard.vercel.app/api/auth-config
```

The `origin` value returned there is the value that must be listed in **Authorised JavaScript origins**.

## 4. Deploy

Click **Deploy**.

After deployment:

- The dashboard URL will be the Vercel project URL.
- The Hapana proxy will be available at `/api/hapana`.
- Site connectivity can be checked at `/api/hapana?mode=sites`.
- A first-pass Core report download can be tested at `/api/core-report?location=UFC%20GYM%20Bankstown&date_from=01/06/2026&date_to=03/06/2026`.

## Current Limitation

The Hapana Public API key works for sites, clients, packages, sessions, and per-client purchases. The documented Public API does not currently expose a site-level DD/POS payment feed, so the dashboard still uses workbook revenue until Hapana provides the revenue/reporting endpoint.

The `/api/core-report` route uses a server-side browser to log in to the legacy Core site and download the Net Revenue Detail CSV. It is the path for real revenue exports; once the single-location test works, the next step is adding a run history table and multi-location progress UI.
