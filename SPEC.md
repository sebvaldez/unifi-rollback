# UniFi Fleet Firmware Manager — Design & Implementation Spec

Local macOS app for inventorying UniFi devices across sites, tracking firmware
versions, and safely rolling devices back to a known-good, checksum-verified
firmware build. Built with Wails (Go backend + Vite/TypeScript/React frontend),
styled to match UniFi's own visual language.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## 1. Goals

- [ ] Inventory all UniFi devices across sites the user has access to (model,
      current firmware, online/adoption state).
- [ ] Maintain a **locally-curated firmware manifest** per model/version,
      sourced from official download links and community release threads.
- [ ] Validate and SHA256-checksum any firmware binary before it's eligible
      to be pushed to a device — visually marked "verified" only on match.
- [ ] Push a rollback (or any pinned version) to one or more devices via SSH,
      with explicit user confirmation before any write.
- [ ] Optionally use an LLM (Claude and/or OpenAI, user-supplied key) to read
      community.ui.com release threads and produce a structured confidence
      score on whether a given firmware version is safe/advisable.
- [ ] Ship as a signed, notarized macOS app (Apple Silicon) with automated
      build + release via GitHub Actions/tags.

## 2. Non-Goals (v1)

- Not a general UniFi Network Application replacement — no SSID/VLAN/firewall
  config management.
- Not managing non-UniFi devices.
- No Windows/Linux build in v1 (Wails supports it later if needed).
- No auto-scheduled/unattended firmware pushes — every write is user-initiated
  and confirmed.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| App shell | [Wails v2](https://wails.io) |
| Backend | Go |
| Frontend | Vite + TypeScript + React |
| Local DB | SQLite (via `mattn/go-sqlite3` or `modernc.org/sqlite` for cgo-free builds) |
| Credential storage | macOS Keychain via `keybase/go-keychain` — **never SQLite** |
| Styling | Hand-built CSS tokens matching UniFi's palette/typography (no copied logo/brand assets) |
| SSH | `golang.org/x/crypto/ssh` |
| CI/CD | GitHub Actions — build, codesign, notarize, staple, auto-tag release |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Frontend (Vite + React + TS)                │
│  - Device inventory table                    │
│  - Firmware manifest / manual mirror form     │
│  - Rollback confirmation flow                 │
│  - Settings (credential onboarding)           │
│  - Community thread confidence score view     │
└───────────────▲───────────────────────────────┘
                │ Wails bindings (Go methods exposed to JS)
┌───────────────┴───────────────────────────────┐
│  Backend (Go)                                  │
│  ├─ unifi/        Site Manager + Network API   │
│  │                 clients                     │
│  ├─ firmware/     manifest mgmt, download,     │
│  │                 domain allowlist, SHA256     │
│  ├─ ssh/          device push/rollback exec     │
│  ├─ llm/          Claude/OpenAI client for      │
│  │                 confidence scoring           │
│  ├─ store/        SQLite (devices, manifest,    │
│  │                 analysis cache)              │
│  └─ secrets/      Keychain CRUD wrapper         │
└─────────────────────────────────────────────────┘
```

---

## 5. Data Layer

### 5.1 SQLite — non-secret data only

```sql
-- devices discovered via UniFi APIs
CREATE TABLE devices (
    id              TEXT PRIMARY KEY,   -- UniFi device id
    site_id         TEXT NOT NULL,
    mac             TEXT NOT NULL,
    model           TEXT NOT NULL,
    name            TEXT,
    current_fw      TEXT,
    adoption_state  TEXT,
    last_seen       DATETIME,
    updated_at      DATETIME
);

-- curated, user-verified firmware entries
CREATE TABLE firmware_manifest (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model           TEXT NOT NULL,
    version         TEXT NOT NULL,
    url             TEXT NOT NULL,
    sha256          TEXT NOT NULL,
    source_url      TEXT,               -- community post / download page it came from
    pinned_at       DATETIME,
    verified        BOOLEAN DEFAULT 0,
    notes           TEXT,
    UNIQUE(model, version)
);

-- cached LLM analysis of community threads
CREATE TABLE community_analysis (
    post_url        TEXT PRIMARY KEY,
    content_hash    TEXT NOT NULL,      -- hash of scraped post body; re-analyze on change
    confidence_json TEXT NOT NULL,      -- structured LLM output, see §8.2
    analyzed_at     DATETIME
);

-- user-configurable app settings (non-secret)
CREATE TABLE preferences (
    key             TEXT PRIMARY KEY,   -- e.g. 'firmware_cache_dir'
    value           TEXT NOT NULL,
    updated_at      DATETIME
);

Known preference keys:

| key | type | default | description |
|---|---|---|---|
| `firmware_cache_dir` | string | `~/Library/Application Support/<app>/firmware-cache` | Local firmware binary cache (deferred) |
| `device_refresh_mode` | `manual` \| `poll` | `manual` | How device inventory is refreshed |
| `device_poll_interval_seconds` | int | `60` | Poll interval when mode is `poll` (min 15) |
| `device_refresh_on_startup` | bool | `false` | Refresh once when the app opens |

-- metadata only — no secret material ever stored here
CREATE TABLE credentials_meta (
    key_type          TEXT PRIMARY KEY, -- 'site_manager' | 'network_local' | 'claude' | 'openai' | 'device_ssh:<mac>'
    label             TEXT,
    last_validated_at DATETIME,
    masked_suffix     TEXT              -- last 4 chars, for display only
);

-- rollback / push action audit trail
CREATE TABLE action_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id       TEXT NOT NULL,
    from_version    TEXT,
    to_version      TEXT,
    manifest_id     INTEGER,
    initiated_at    DATETIME,
    completed_at    DATETIME,
    result          TEXT,               -- success | failed | verified_fail
    error_detail    TEXT
);
```

### 5.2 macOS Keychain — all secret material

Stored via `keybase/go-keychain`, service namespace `com.<you>.unifi-fleet-tool`:

| account | contents |
|---|---|
| `site-manager-api-key` | Site Manager API key (`api.ui.com`) |
| `network-local-api-key:<site_id>` | Per-site local Network Integration API key |
| `device-ssh:<mac>` | Per-device SSH credential (password or key passphrase) |
| `claude-api-key` | Optional, for confidence scoring |
| `openai-api-key` | Optional, for confidence scoring |

`AccessibleWhenUnlockedThisDeviceOnly`, `SynchronizableNo` on every item (see
§9 of prior discussion for CRUD walkthrough — carry that into `secrets/`
package as `Save`, `Get`, `Delete`, `List` wrapping Add/QueryItem/Update/DeleteItem).

### 5.3 Credentials — architecture & UX

Users may have **multiple API keys** across Site Manager (cloud), Network
Integration (per console/site), optional Classic admin, LLM providers, and
device SSH. UniFi does **not** expose fine-grained OAuth-style scopes on keys;
Integration keys inherit the creating admin's role. The app therefore uses a
**capability-driven** model — not user-selected scopes.

#### Principles

1. **Credential slots, not a key vault** — each slot has a type, optional
   site/host binding, label, validation status, and **derived capabilities**
   (discovered by probing the API on save/revalidate).
2. **No per-row key picker on Devices** — backend resolves
   `purpose + siteId (+ hostId)` to the correct Keychain item.
3. **Graceful degradation** — Site Manager alone enables fleet inventory;
   missing per-site Network keys disable device actions with explicit reasons.
4. **No fake scope checkboxes** — never ask the user to tick "restart" or
   "inventory"; run validation probes instead.

#### Slot types (v1)

| Slot kind | Typical count | Unlocks (when validated) |
|---|---|---|
| `site_manager` | 1 (N in v2) | Fleet inventory, Connector Proxy |
| `network_integration` | 1 per site/host | Device read, restart, rollback verify |
| `classic_admin` | 0–1 per console | LED locate (Classic API gap-fill) |
| `llm_claude` / `llm_openai` | 0–1 each | AI assistant / thread analysis |
| `device_ssh` | 0–N per MAC | Firmware rollback push |

Keychain accounts remain as in §5.2. SQLite `credentials_meta` stores
`label`, `last_validated_at`, `masked_suffix`, and (future) serialized
capability list per slot id.

#### Validation flow (backend — follow-up)

1. User pastes secret in Settings → **Save**.
2. Backend probes the appropriate API (`GET /v1/sites`, `GET /v1/info`, etc.).
3. On success: store in Keychain, upsert `credentials_meta`, return
   `capabilities[]` + `status: configured`.
4. On failure: return `status: invalid` + error message; do not store.

#### Settings UI

Replace the single Site Manager input with a **credential registry**:

- **Fleet access** — Site Manager slot(s): status badge, capability chips,
  Validate / Replace / Remove.
- **Device control (per site)** — one row per discovered site missing a Network
  Integration key; inline Add key after first inventory refresh.
- **Optional** — Classic admin (locate), LLM keys (collapsed section).

Multi Site Manager keys (v2): list with "Include in fleet view" toggle; merge
inventories with source label — no per-device key selection.

#### Devices UI

- Row actions enabled/disabled from **`device.capabilities`**, not raw keys.
- Tooltip / disabled reason explains missing capability (e.g. "Requires Network
  API key for Lab site — configure in Settings").
- Optional banner when inventory is partial: "N sites lack device control keys
  — [Configure in Settings]".

#### Explicit non-goals

- Global "active API key" dropdown.
- User-managed scope matrices.
- Blocking the app when optional keys are missing.

- [~] Frontend: credential registry UI + capability-driven device actions
      (Wails stubs until `secrets/` + validation land).
- [ ] Backend: Keychain CRUD, validation probes, capability derivation.

---

## 6. UniFi API Integration

| Surface | Base | Auth | Use |
|---|---|---|---|
| Site Manager API | `https://api.ui.com/v1` | `X-API-Key` | Fleet/site inventory, `GET /hosts`, `/sites`, `/devices` |
| Local Network Integration API | `https://<controller>/proxy/network/integration/v1` | `X-API-Key` | Per-device firmware/version detail, `GET /sites/{id}/devices` |

- [ ] Onboarding: user pastes Site Manager key → validate with a live
      `GET /sites` call → store in Keychain → write `credentials_meta` row.
- [ ] Repeat for local Network API key(s), one per site/controller.
- [ ] Inventory refresh writes into `devices` table. Manual refresh (status
      indicator click) or opt-in polling while the app is open — not unattended
      background scheduling. Preferences: `device_refresh_mode`,
      `device_poll_interval_seconds`, `device_refresh_on_startup` (§5.1).
      *Current branch: refresh UI + preferences only; UniFi API client deferred.*

**No firmware-push action exists in the official API** (confirmed — neither
surface exposes a documented "install this version" or downgrade action).
Rollback execution is therefore handled via SSH (§7), not the API.

---

## 7. Firmware Manifest & Rollback Flow

### 7.1 Discovery (best-effort, advisory only)

- [ ] Tier 1: headless-browser render of `ui.com/download/software/<model>`
      to suggest a version/link. **Advisory only** — page is JS-rendered and
      has changed structure before; failures must degrade gracefully.
- [ ] Tier 2 (primary): **manual mirror entry** — user pastes a firmware URL
      (e.g. from a community.ui.com release thread) plus target model/version.

### 7.2 Validation gate (must pass before a manifest entry is usable)

1. [ ] **Domain allowlist** — reject anything not on `dl.ui.com` or
       `fw-download.ubnt.com`.
2. [ ] **HEAD request check** — 200 status, sane content-length/type.
3. [ ] **Download** to local cache (location TBD — open question, §10).
4. [ ] **SHA256** computed on downloaded file.
5. [ ] **First pin**: show hash to user, require explicit confirmation
       against the community post / download page before saving to
       `firmware_manifest` with `verified = 1`.
6. [ ] **Every reuse**: re-hash cached file, compare to pinned value. ✅ badge
       renders only on match; mismatch blocks the rollback action entirely
       and surfaces a hard error.

### 7.3 Rollback execution

- [ ] User selects target device(s) + a `verified` manifest entry.
- [ ] Confirmation screen shows: device(s), current version → target version,
      SHA256 of the binary, source link.
- [ ] Backend SSHes to device, transfers/pushes `.bin`, issues upgrade command.
- [ ] Poll Network Integration API afterward to confirm reported version
      actually changed; write `action_log` row either way.

---

## 8. LLM-Assisted Community Confidence Score

### 8.1 Trigger

- [ ] User-initiated only ("Analyze this thread" button) — no background
      polling of community.ui.com.

### 8.2 Pipeline

1. Fetch community post HTML → extract plain text (strip nav/chrome).
2. Hash the extracted text (`content_hash`) — check `community_analysis`
   cache first; skip LLM call if hash unchanged since last analysis.
3. Send to configured LLM (Claude preferred if both keys present; OpenAI as
   fallback/alternate) with a **structured-output-only** prompt. Target schema:

```json
{
  "reported_by_count": 0,
  "sentiment": "positive | negative | mixed",
  "symptoms_mentioned": ["string"],
  "versions_discussed": ["string"],
  "explicit_recommendation": "string | null",
  "confidence": 0,
  "rationale": "string"
}
```

4. Cache result + show `rationale` alongside the numeric score in the UI —
   never show a bare number without the reasoning text.
5. Small/cheap model tier is sufficient (short extraction/summarization task).

---

## 9. Styling — UniFi Visual Parity

- [ ] Extract design tokens only (colors, spacing scale, font stack) via
      devtools inspection of app.ui.com / unifi.ui.com.
- [ ] **Do not** copy Ubiquiti logo/wordmark or other trademarked assets —
      build your own app icon/name.
- [ ] Implement as CSS custom properties (`--unifi-color-*`, `--unifi-font-*`)
      consumed by React components.

---

## 10. Open Questions

- [x] **Firmware cache location** — resolved: stored as a user-configurable
      value in the new `preferences` table (§5.1, key `firmware_cache_dir`),
      defaulting to `~/Library/Application Support/<app>/firmware-cache`.
- [ ] **Apple Developer Program / CI signing setup** (§11.1) — deferred.
      Leave unresolved until the app is mostly working; revisit before
      building out §11 CI/CD.
- [ ] **Release tagging convention** (§11.2) — manual `git tag` push vs.
      release-please/semantic-release bot. Deferred alongside the above.

---

## 11. CI/CD — Build, Sign, Notarize, Auto-Tag Release

Target: tag a version (e.g. `v0.1.0`) → GitHub Actions builds a Wails app for
Apple Silicon (`darwin/arm64`) → codesigns → notarizes → staples ticket →
attaches `.dmg`/`.zip` to a GitHub Release automatically.

### 11.1 Requirements

- [ ] Apple Developer Program membership (for a Developer ID Application
      certificate + notarization credentials) — **deferred, see §10**.
- [ ] Exported `.p12` signing certificate + notarization API key stored as
      GitHub Actions **encrypted secrets** (never committed).
- [ ] `wails build -platform darwin/arm64` in CI.

### 11.2 Workflow shape (`.github/workflows/release.yml`)

- [ ] Trigger: `on: push: tags: ['v*']`.
- [ ] Steps:
  1. Checkout, set up Go + Node.
  2. `wails build -platform darwin/arm64 -clean`.
  3. Codesign `.app` with Developer ID Application cert (imported from
     secret).
  4. Notarize via `xcrun notarytool submit --wait`.
  5. Staple ticket: `xcrun stapler staple`.
  6. Package as `.dmg` (e.g. via `create-dmg`).
  7. Create GitHub Release from the pushed tag, attach `.dmg`, auto-generate
     release notes from commits/PRs since last tag.
- [ ] Version bump convention: decide tagging trigger (manual `git tag` push
      vs. a release-please/semantic-release bot) — **deferred, see §10**.

### 11.3 Repo hygiene

- [ ] `.gitignore`: `frontend/dist`, `build/bin`, `*.env`, any local SQLite
      db file, firmware cache dir.
- [ ] No credentials, API keys, or `.p12` files ever committed.
- [ ] README with install instructions (download `.dmg` from Releases page).

---

## 12. Implementation Checklist (rollup)

- [x] Scaffold Wails project (`wails init`), Go module layout per §4.
- [x] SQLite migrations for schema in §5.1.
- [x] Device refresh preferences (manual / poll, interval, startup) in Settings.
- [ ] `secrets/` package wrapping go-keychain CRUD.
- [ ] Onboarding UI: collect + validate Site Manager key, Network key(s),
      optional Claude/OpenAI keys.
- [ ] `unifi/` client: Site Manager + Network Integration API calls.
- [ ] Device inventory screen.
- [ ] `firmware/` package: domain allowlist, download, SHA256, manifest CRUD.
- [ ] Manual mirror entry UI + verified badge rendering.
- [ ] Tier-1 headless scrape (best-effort, optional/deferrable to later pass).
- [ ] `ssh/` package: push binary + issue upgrade command.
- [ ] Rollback confirmation flow + `action_log` writes.
- [ ] `llm/` package: Claude/OpenAI structured-output client + caching.
- [ ] Community thread confidence score UI.
- [ ] UniFi-parity design tokens + component styling pass.
- [ ] GitHub Actions release workflow (§11).
- [ ] README + install docs.