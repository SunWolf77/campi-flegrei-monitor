# Deploy: GitHub → Vercel

Repo: [SunWolf77/campi-flegrei-monitor](https://github.com/SunWolf77/campi-flegrei-monitor)

## 1. GitHub

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

**None required.** Public feeds only.

**Recommended production defaults:**

```text
VITE_AUTH_ENABLED=false
SITE_URL=https://campi-flegrei-monitor.vercel.app
```

### Optional — Better Auth / Postgres (only if you enable login)

| Variable | Required? | Notes |
|---|---|---|
| `VITE_AUTH_ENABLED` | optional | Default off for pure monitor |
| `BETTER_AUTH_SECRET` | if auth on | Long random secret |
| `BETTER_AUTH_URL` | if auth on | Production URL |
| `DATABASE_URL` | if auth on | Neon/Postgres |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | if OAuth | GitHub OAuth app |

Do **not** set `DATABASE_URL` unless you intentionally enable auth.

## 4. After first deploy

1. Open production URL — confirm map loads CF events (GOSSIP)
2. Pulse strip shows EII / RPAM / SR
3. Theme toggle + Quiet mode persist in browser localStorage

## 5. Link to Sun-Earth-Sentinel

This app is SES focus node **#2** (Campi Flegrei). Tonga–Kermadec is node **#1** inside the same UI. Authority routing never dual-reads INGV↔USGS.

## 6. X / Twitter share card

X needs **Open Graph + Twitter Card** tags with an **absolute HTTPS image**.

| Tag | Value |
|---|---|
| `twitter:card` | `summary_large_image` |
| `og:image` / `twitter:image` | `https://campi-flegrei-monitor.vercel.app/og.png` |
| Size | **1200×630** PNG in `/public/og.png` |

After deploy:

1. Confirm image: open `/og.png` in browser
2. Confirm HTML source contains `twitter:card` and `og:image`
3. **Bust X cache** — cards are cached hard. Re-share with `?v=2` once, or wait; Card Validator may be restricted on free accounts

Optional env for custom domain (rebuild after change):

```text
SITE_URL=https://your-custom-domain.com
```

---

*Not a civil-protection product.*
