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

## 3. Deploy

Click **Deploy**.

After deployment:

- The dashboard URL will be the Vercel project URL.
- The Hapana proxy will be available at `/api/hapana`.
- Site connectivity can be checked at `/api/hapana?mode=sites`.

## Current Limitation

The Hapana Public API key works for sites, clients, packages, sessions, and per-client purchases. The documented Public API does not currently expose a site-level DD/POS payment feed, so the dashboard still uses workbook revenue until Hapana provides the revenue/reporting endpoint.
