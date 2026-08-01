# Campi Flegrei Monitor · Sun-Earth-Sentinel node #2

Observational seismic / volcanic monitor for **Campi Flegrei** (primary) and **Tonga–Kermadec** (SES node #1 companion), built to merge into the [Sun-Earth-Sentinel](https://github.com/SunWolf77) network.

> **Not a civil-protection product.** SUPT / Continuum / Schumann layers are pattern-detection tools, not forecasts.

## Features

| Layer | What |
|---|---|
| **Authority routing** | CF → INGV GOSSIP (→ FDSN); TK → USGS. No dual-read across families |
| **Map / depth / swarms** | OSM basemap, depth gates, swarm intensity, cluster cards |
| **SUPT detective** | Frozen probe, ETAS residual, stress nodes, fracture planes (Focus / Advanced) |
| **Continuum EII** | Md + shallow + ψₛ (Kp/solar wind) + **Tomsk Schumann ELF factor** |
| **Epoch memory** | Notion-seeded harmonic learning DB + live learn + **JSON/CSV export** |
| **Feeds** | Schumann, GeoNet VAL (Kermadec), LAIC brief, Pacific node registry |
| **UX** | Pulse strip, Quiet / Field mode, light·dark·system theme, progressive disclosure |

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

## Vercel deploy (new repo)

1. Create empty GitHub repo (e.g. `campi-flegrei-monitor` or `ses-campi-flegrei-node`).
2. Push this tree:

```bash
git init
git add .
git commit -m "Initial: Campi Flegrei SES node #2 monitor"
git branch -M main
git remote add origin https://github.com/SunWolf77/<REPO>.git
git push -u origin main
```

3. Vercel → **Import** the repo → Framework **Other** / Vite is fine (Nitro emits Vercel output on `npm run build`).
4. Build command: `npm run build`  
   Output: leave default (Nitro/Vercel adapter handles `.vercel/output`).
5. Env: none required for core seismic + Schumann feeds (public APIs).

### Build contract

- Listen on **`0.0.0.0:8080`** in dev (preview).  
- Production uses Nitro `preset: "vercel"` **only when `command === "build"`** so dev stays single-port.

## Progressive disclosure (cognitive load)

Designed so the **pulse** answers first, then optional depth:

1. **Pulse strip** — EII · RPAM · SR · intensity · rates (always)  
2. **4 KPIs** — catalog snapshot  
3. **Tabs** — Map default; SUPT focus mode; Feeds for ELF/memory  
4. **Filters** — collapsed until opened  
5. **Quiet / Field** — hides LAIC, Notion, Pacific library side panels  
6. **Mobile auto-quiet** — first visit under 768px starts Quiet (`auto-mobile`); user override stored  

Intrinsic load lives in the catalog; extraneous load is gated behind Focus/Full/Advanced.

## Data authorities

| Node | Authority | Rationale |
|---|---|---|
| Campi Flegrei | INGV GOSSIP → FDSN | USGS under-samples shallow Md swarm |
| Tonga–Kermadec | USGS | Oceanic arc; GeoNet VAL for Kermadec Islands volcano status |

## License / methodology

- Sheppard’s Universal Proxy Theory (SUPT) — U.S. Copyright TXu 2-468-771  
- Ports from SunWolf SUPT / ReSunance Continuum / Comparative Harmonic System repos  
- Seismic data © INGV / USGS / GeoNet — use per their terms  

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server 8080 |
| `npm run build` | Production build + migrate |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Serve production build on 8080 |

---

*SunWolf · SolWatch / SES observational network*
