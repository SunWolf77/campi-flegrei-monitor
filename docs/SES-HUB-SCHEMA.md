# SES hub JSON schema & feed contract

Contract between **sun-earth-sentinel** (hub) and focus boards  
(e.g. [campi-flegrei-monitor](https://campi-flegrei-monitor.vercel.app/)).

Machine schemas:

| Schema | Path |
|--------|------|
| Catalog GeoJSON | [`docs/schemas/ses-catalog.schema.json`](./schemas/ses-catalog.schema.json) |
| Volcano status | [`docs/schemas/ses-volcano-status.schema.json`](./schemas/ses-volcano-status.schema.json) |
| Swarm analysis (board / future hub) | [`docs/schemas/ses-swarm-analysis.schema.json`](./schemas/ses-swarm-analysis.schema.json) |

Implementations: `src/lib/seismic/ses-bridge.ts`, `ses-handoff.ts`,  
`src/routes/api/ses/catalog.ts`, `src/routes/api/ses/volcano.ts`.

---

## 1. Network identity

| Dragon id (`sesNode` / hub `node`) | Board focus node | Authority family | Primary providers |
|------------------------------------|------------------|------------------|-------------------|
| `mediterranean` | `campi-flegrei` | `ingv-family` | GOSSIP → INGV FDSN |
| `vesuvius` | `vesuvius` | `ingv-family` | GOSSIP vesuvio |
| `tonga` | `tonga-kermadec` | `usgs-family` | USGS |
| `japan` / `kamchatka` | external boards | (other) | — |

**Rule:** one authority family per node. Never dual-read USGS + INGV for the same focus bbox.

Aliases accepted by boards for `?node=` / `?sesNode=`:  
`mediterranean`, `campi`, `campi-flegrei`, `cf`, `flegrei`, `vesuvius`, `ve`, `vesuvio`, `tonga`, `tonga-kermadec`, `tk`, `kermadec`.

---

## 2. Handoff (URL)

### Hub → board

```
https://campi-flegrei-monitor.vercel.app/?from=ses&sesNode=mediterranean
https://campi-flegrei-monitor.vercel.app/?from=ses&sesNode=vesuvius&window=7d
```

| Query | Meaning |
|-------|---------|
| `from=ses` | Visit originated from Sentinel (return chip) |
| `sesNode` / `node` | Dragon id or focus alias |
| `window` | Optional `24h` \| `48h` \| `7d` \| `30d` \| `ytd` |

### Board → hub

```
https://sun-earth-sentinel.vercel.app/?tab=live&node=mediterranean
```

---

## 3. Catalog feed (primary hub merge)

### Endpoint

```http
GET /api/ses/catalog?node={dragonId}&window={windowKey}
```

| Param | Default | Notes |
|-------|---------|--------|
| `node` or `sesNode` | `campi-flegrei` (board default) | Dragon or alias |
| `window` | `7d` | `24h` \| `48h` \| `7d` \| `30d` \| `ytd` |

**CORS:** `Access-Control-Allow-Origin: *`  
**Cache:** `public, max-age=60, stale-while-revalidate=120`  
**Header:** `X-Ses-Feed: campi-flegrei-monitor`

Example (production board):

```
https://campi-flegrei-monitor.vercel.app/api/ses/catalog?node=mediterranean&window=7d
```

### Response envelope

GeoJSON **FeatureCollection** + SES `metadata` (see schema).

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "gossip-…",
      "properties": {
        "mag": 1.2,
        "place": "Pozzuoli",
        "time": 1723123456789,
        "updated": 1723123456789,
        "title": "M1.2 - Pozzuoli",
        "type": "earthquake",
        "status": "reviewed",
        "magType": "Md",
        "sesSource": "gossip",
        "sesNodeId": "campi-flegrei"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [14.139, 40.827, 1.8]
      }
    }
  ],
  "metadata": {
    "generated": 1723123999000,
    "count": 412,
    "title": "SES focus feed · mediterranean",
    "authority": "ingv-family",
    "nodeId": "campi-flegrei",
    "dragonId": "mediterranean",
    "window": "7d",
    "provider": "gossip",
    "sourceUrl": "https://…",
    "board": "campi-flegrei-monitor",
    "note": "INGV-OV authority — replace USGS inside CF bbox; never dual-read."
  }
}
```

### Feature geometry

```
coordinates = [ longitude, latitude, depthKm? ]
```

Depth is **positive down, kilometres** (not metres). Compatible with USGS-style EqFeature lists on the hub.

### Magnitude policy

- `mag` may be **`null`** (GOSSIP N/D).
- Do **not** coerce null → `0` for energy or sorting as “M0”.
- `magType` is free text (`Md`, `ML`, `mb`, …).

---

## 4. Hub merge algorithm (contract)

Implemented on the board as `mergeSesWithAuthorityNode` and documented for hub `publishedMonitors` / refresh hooks:

```text
1. Keep global USGS (or other) features for the world map.
2. When focus dragon = mediterranean | vesuvius | … with a published node feed:
   a. DROP any USGS (or foreign-family) feature whose point falls inside the node bbox.
   b. INJECT all features from GET {board}/api/ses/catalog?node={dragonId}.
3. Dedupe by feature.id (node features win on collision).
4. Never call USGS FDSN and INGV/GOSSIP for the same CF/VE bbox in one tick.
```

**Authority matrix**

| Dragon | Strip in-bounds family | Inject from |
|--------|------------------------|-------------|
| `mediterranean` | `usgs-family` | this board, INGV-OV |
| `vesuvius` | `usgs-family` | this board, INGV-OV |
| `tonga` | (USGS is authority) | TK board USGS feed |

---

## 5. Volcano status companion

```http
GET /api/ses/volcano
```

Type: `ses-volcano-status` — CF INGV operational note + optional GeoNet Kermadec companion for lattice sync.  
**Not** a substitute for the seismic catalog; **not** a forecast.

Schema: [`ses-volcano-status.schema.json`](./schemas/ses-volcano-status.schema.json).

---

## 6. Swarm analysis (board-internal; hub optional)

`SwarmAnalysis` / `SwarmCluster` power the board Swarm tab and SUPT.  
They are **not** currently nested inside `/api/ses/catalog`.

If the hub later wants swarm KPIs without re-detecting clusters:

1. Prefer a sidecar, e.g. `GET /api/ses/swarm?node=mediterranean&window=7d`, **or**
2. Optional `metadata.swarm` object on the catalog feed.

Canonical field names (do not use legacy `maxMagnitude`):

| Object | Required fields |
|--------|-----------------|
| **SwarmCluster** | `id`, `count`, `start`, `end`, `centroid`, `meanDepthKm`, `medianDepthKm`, `depthRangeKm` `[min,max]`, `maxMag`, `maxMagEvent`, `eventIds`, `topEvents`, `energyProxy`, `ratePerHour`, `durationHours`, `isActive` |
| **SwarmEventChip** | `id`, `magnitude` (nullable), `depthKm`, `time`, `magType` |
| **SwarmAnalysis** | `active`, `clusters`, `rate1h`, `rate6h`, `rate24h`, `maxMagWindow`, `meanDepthKm`, `shallowFraction`, `cumulativeEnergy`, `hourlyBins[]` |

Full JSON Schema: [`ses-swarm-analysis.schema.json`](./schemas/ses-swarm-analysis.schema.json).

### Transport notes (if published)

- Cap `clusters` ≤ 20, `eventIds` ≤ 200, `topEvents` ≤ 8, `hourlyBins` ≤ 72 (board `slimSwarm`).
- Resolve full hypocentres via catalog `features` + `eventIds`, not nested full events.
- `isActive` means last event within ~6 h — operational flag, not a formal bulletin.

---

## 7. Error responses

Catalog failure:

```json
{
  "ok": false,
  "error": "…",
  "nodeId": "campi-flegrei"
}
```

HTTP 500 · `Cache-Control: no-store`.

---

## 8. Versioning & headers

| Header | Value |
|--------|--------|
| `X-Ses-Feed` | Board id (`campi-flegrei-monitor`, …) |
| `Content-Type` | `application/json; charset=utf-8` |

Breaking changes to required GeoJSON properties should bump board docs and hub `publishedMonitors` in lockstep. Additive `metadata.*` and `properties.ses*` fields are non-breaking.

---

## 9. Out of scope of SES catalog JSON

These live on the board only (or separate EO APIs), not in the hub catalog schema:

- Sentinel-2 Phase A–C / S1 Phase D1 EO packs  
- SolfataraNews embeds  
- SUPT fabric geometry  
- Epoch warehouse rows  

Seismic **authority** for Mediterranean / Vesuvius remains **INGV-OV GOSSIP/FDSN** regardless of EO layers.

---

## 10. Quick validation (operator)

```bash
# Catalog
curl -sS "https://campi-flegrei-monitor.vercel.app/api/ses/catalog?node=mediterranean&window=7d" \
  | jq '{type, n: (.features|length), meta: .metadata}'

# Volcano companion
curl -sS "https://campi-flegrei-monitor.vercel.app/api/ses/volcano" \
  | jq '{type, dragonId, authority, severity: .resonance.severity}'
```

Local board:

```bash
curl -sS "http://127.0.0.1:8080/api/ses/catalog?node=mediterranean&window=7d" | jq '.metadata'
```
