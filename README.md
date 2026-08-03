# Campi Flegrei Monitor · Sun-Earth-Sentinel node #2

Observational seismic / volcanic monitor for **Campi Flegrei** (primary) and **Tonga–Kermadec** (SES node #1 companion), built to merge into the [Sun-Earth-Sentinel](https://github.com/SunWolf77) network.

> **Not a civil-protection product.** SUPT / Continuum / Schumann layers are pattern-detection tools, not forecasts.

## Features

| Layer | What |
| --- | --- |
| **Authority routing** | CF → INGV GOSSIP (→ FDSN); TK → USGS. No dual-read across families |
| **Map / depth / swarms** | OSM basemap, depth gates, swarm intensity, cluster cards |
| **SUPT detective** | Frozen probe, ETAS residual, stress nodes, fracture planes (Focus / Advanced) |
| **Continuum EII** | Md + shallow + ψₛ (Kp/solar wind) + **Schumann ELF factor** (ResonanceOne / Tomsk-attributed) |
| **Epoch memory** | Notion-seeded harmonic learning DB + live learn + **JSON/CSV export** |
| **Feeds** | Schumann, GeoNet VAL (Kermadec), LAIC brief, Pacific node registry |
| **UX** | Pulse in header, collapsible chrome, Quiet mode, light·dark·system, map-first layout |

## Stack

- React 19 · TypeScript · Vite 8 · TanStack Start / Router / Query
- Tailwind v4 · Radix/shadcn · Leaflet · Recharts · Zustand
- Deploy: **Vercel** via Nitro preset (`vite.config.ts` — nitro only on `build`)

## Local develop

```bash
npm install
npm run dev          # http://0.0.0.0:8080
npm run typecheck
npm run build        # production + Nitro vercel output
```

## Deploy

**Repo:** [github.com/SunWolf77/campi-flegrei-monitor](https://github.com/SunWolf77/campi-flegrei-monitor)

Full guide: **[docs/DEPLOY.md](docs/DEPLOY.md)** (Vercel env vars, CI, SES link).

```bash
git remote add origin https://github.com/SunWolf77/campi-flegrei-monitor.git
git push -u origin main
```

1. Vercel → **Import** this repo
2. Build: `npm run build` · Node **22**
3. Env for core monitor: **none required** (set `VITE_AUTH_ENABLED=false` if you want explicit auth-off)
4. CI: GitHub Actions on `main` / PRs runs typecheck + production build

### Build contract

- Listen on **`0.0.0.0:8080`** in dev (preview).
- Production uses Nitro `preset: "vercel"` **only when `command === "build"`** so dev stays single-port.

## Progressive disclosure (cognitive load)

Designed so the **pulse** answers first, then optional depth:

1. **Pulse in sticky header** — EII · RPAM · SR · intensity · rates (always)
2. **Collapsible chrome** — chevron collapses node/window/filters; auto on mobile / short viewports when Map is open
3. **Map-first** — KPIs hidden on Map tab; observation links collapsed under map
4. **Filters** — collapsed until opened
5. **Quiet** — hides library side panels; mobile first-visit auto-quiet under 768px
6. **Visual Viewport** — map height tracks mobile browser chrome / keyboard
7. **Container queries** — link grids / map meta respond to panel width, not only viewport

Intrinsic load lives in the catalog; extraneous load is gated behind collapse / Quiet / Advanced.

## Data authorities

| Node | Authority | Rationale |
| --- | --- | --- |
| Campi Flegrei | INGV GOSSIP → FDSN | USGS under-samples shallow Md swarm |
| Tonga–Kermadec | USGS | Oceanic arc; GeoNet VAL for Kermadec Islands volcano status |

## License / methodology

- Sheppard’s Universal Proxy Theory (SUPT) — U.S. Copyright TXu 2-468-771
- Ports from SunWolf SUPT / ReSunance Continuum / Comparative Harmonic System repos
- Seismic data © INGV / USGS / GeoNet — use per their terms

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server 8080 |
| `npm run build` | Production build + migrate |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Serve production build on 8080 |

---

*SunWolf · SolWatch / SES observational network*
