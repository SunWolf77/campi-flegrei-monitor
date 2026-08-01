# Deploy: GitHub → Vercel

Repo: [SunWolf77/campi-flegrei-monitor](https://github.com/SunWolf77/campi-flegrei-monitor)

## 1. GitHub (done when remote is pushed)

```bash
git remote add origin https://github.com/SunWolf77/campi-flegrei-monitor.git
git push -u origin main
```

CI runs on every push/PR to `main` (typecheck + production build).

## 2. Vercel project

1. [vercel.com/new](https://vercel.com/new) → **Import** `SunWolf77/campi-flegrei-monitor`
2. Framework preset: leave auto / Other  
3. **Build command:** `npm run build`  
4. **Install:** `npm install` (or `npm ci`)  
5. Output: Nitro emits `.vercel/output` — do not set a custom `dist` directory  
6. Node: **22.x**

`vercel.json` in repo sets `buildCommand` / `installCommand`.

## 3. Environment variables

### Core monitor (seismic + Schumann + GeoNet)

**None required.** Public feeds only:

| Feed | URL |
|---|---|
| INGV GOSSIP / FDSN | public |
| USGS FDSN | public |
| NOAA SWPC (Kp / solar wind) | public |
| ResonanceOne / Tomsk charts | public |
| GeoNet VAL | public |

### Optional — Better Auth / Postgres (only if you enable login)

| Variable | Required? | Notes |
|---|---|---|
| `VITE_AUTH_ENABLED` | optional | Default off for pure monitor. Set `true` only with full auth stack |
| `BETTER_AUTH_SECRET` | if auth on | Long random secret |
| `BETTER_AUTH_URL` | if auth on | `https://your-app.vercel.app` |
| `DATABASE_URL` | if auth on | Neon/Postgres connection string |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | if OAuth | GitHub OAuth app |

**Recommended production defaults for this node:**

```text
VITE_AUTH_ENABLED=false
```

Do **not** set `DATABASE_URL` unless you intentionally enable auth (CI and local PGLite fallback work without it).

### Optional — public URL

| Variable | Notes |
|---|---|
| `SITE_URL` | Canonical site URL if you add SEO/share later |
| `VERCEL_URL` | Injected automatically by Vercel |

## 4. After first deploy

1. Open production URL — confirm map loads CF events (GOSSIP)  
2. Pulse strip shows EII / RPAM / SR  
3. Theme toggle + Quiet mode persist in browser localStorage  
4. If blank page: check browser console for asset MIME errors (base path) — Nitro preset should avoid this  

## 5. Link to Sun-Earth-Sentinel

This app is SES focus node **#2** (Campi Flegrei). Tonga–Kermadec is node **#1** inside the same UI. Authority routing never dual-reads INGV↔USGS.

---

*Not a civil-protection product.*
