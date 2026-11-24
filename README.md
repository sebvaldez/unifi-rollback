# UniFi Fleet Firmware Manager

Local macOS app for inventorying UniFi devices across sites, tracking firmware
versions, and safely rolling devices back to a known-good, checksum-verified
firmware build.

Built with [Wails v3](https://v3.wails.io) (Go backend + Vite/TypeScript/React
frontend). See [SPEC.md](./SPEC.md) for the full design and implementation plan.

## Project layout

The repo follows a Wails-friendly layout inspired by
[golang-standards/project-layout](https://github.com/golang-standards/project-layout):
thin Wails glue at the root, private backend code under `internal/`, and the
frontend kept where Wails expects it.

```
unifi-rollback/
├── main.go                 # App entrypoint: embeds frontend assets, starts Wails
├── app.go                  # Wails-facing API — methods bound to the React UI
├── wails.yaml              # Wails project config (build/dev commands, app name)
├── go.mod / go.sum         # Go module definition and checksums
│
├── internal/               # Private backend packages (not importable outside this module)
│   ├── unifi/              # UniFi Site Manager + Network Integration API clients
│   ├── firmware/           # Firmware manifest, download, domain allowlist, SHA256
│   ├── secrets/            # macOS Keychain CRUD (§5.2)
│   └── store/              # SQLite persistence (devices, manifest, action log)
│
├── frontend/               # Vite + React + TypeScript UI
│   ├── src/                # React components, styles, and static assets
│   └── bindings/           # Generated Go to JS bindings (do not edit by hand)
│
├── build/                  # Wails packaging assets and build output
│   ├── darwin/             # macOS Info.plist templates and dev overrides
│   ├── windows/            # Windows installer assets (unused in v1; kept by Wails)
│   └── bin/                # Compiled app binary (gitignored; created by `wails3 build`)
│
├── SPEC.md                 # Design spec, data model, and implementation checklist
└── .gitignore
```

### Root files

| File | Responsibility |
|---|---|
| `main.go` | Bootstraps the desktop app: embeds `frontend/dist`, configures the window, and registers the Wails runtime. |
| `app.go` | Defines the struct and methods exposed to JavaScript. Delegates to `internal/*` as features are implemented. |
| `wails.yaml` | Source of truth for Wails: app name, frontend build commands, and output paths. |

### `internal/`

Application logic that should not be imported by other Go modules. Packages are
added here as they are implemented.

| Package | Responsibility |
|---|---|
| `internal/unifi` | HTTP clients for `api.ui.com` (Site Manager) and per-site Network Integration APIs. Device inventory and firmware version reads. |
| `internal/firmware` | Curated firmware manifest CRUD, download validation, domain allowlisting (`dl.ui.com`, `fw-download.ubnt.com`), and SHA256 verification. |
| `internal/secrets` | macOS Keychain wrapper (`go-keychain`). Service `com.wails.unifi-rollback`. Secrets never touch SQLite. |
| `internal/store` | SQLite via Goose migrations + sqlc queries. Schema in `schema.sql`; DB at `~/Library/Application Support/unifi-rollback/`. |

Future packages (`ssh`, `llm`, etc.) will live here as well — see SPEC.md §4 and §12.

### `frontend/`

| Path | Responsibility |
|---|---|
| `frontend/src/` | React application source: screens, components, and UniFi-parity design tokens. |
| `frontend/src/assets/` | Static images, fonts, and other files imported by the UI. |
| `frontend/bindings/` | Generated TypeScript bindings for Go methods on `App`. Regenerate with `wails3 generate bindings -ts`. |
| `frontend/dist/` | Production frontend build output embedded into the Go binary (gitignored). |

### `build/`

| Path | Responsibility |
|---|---|
| `build/darwin/` | macOS-specific plist templates used when packaging the `.app`. |
| `build/windows/` | Windows installer and icon assets from the Wails template. Not targeted in v1 but safe to keep. |
| `bin/` | Final compiled application (`unifi-rollback.app`). Gitignored. |
| `build/appicon.png` | Application icon source used during packaging. |

## Development

**Prerequisites:** Go 1.27.4 (pinned in `mise.toml`), [Wails v3 CLI](https://v3.wails.io/getting-started/installation/), Node.js 20+.

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.1.0
WAILS_EXP_USE_WAKE=1 wails3 dev
```

Wails 3.1 reads `wails.yaml` only when `WAILS_EXP_USE_WAKE` is set.
The dev server listens on port 9245. `npm run dev` by itself uses port 5173.

**Keychain dev tools** (Settings, visible only in `wails3 dev`): add test
credentials, list account names, delete, or wipe the app namespace. Production
builds hide this panel. Destructive actions use an in-app typed confirm
(`DELETE`). If list/delete fail after a rebuild, remove stale entries in
Keychain Access (login keychain) or restart `wails3 dev`.

**Frontend only** (from `frontend/`):

```bash
npm install
npm run dev
```

## Building

Production build for Apple Silicon:

```bash
WAILS_EXP_USE_WAKE=1 wails3 build
```

Output: `bin/unifi-rollback.app`

Open it locally:

```bash
open bin/unifi-rollback.app
```
