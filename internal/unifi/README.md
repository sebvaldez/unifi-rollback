# UniFi API clients

Go HTTP clients for Ubiquiti APIs used by Fleet Manager.

## Packages

| Client | File | Auth | Use |
|--------|------|------|-----|
| `SiteManagerClient` | `sitemanager.go` | `X-API-KEY` (cloud) | Fleet inventory: sites, hosts, devices |
| `NetworkClient` | `network.go` | `X-API-KEY` (Integration) | Per-site devices, RESTART, statistics |
| Connector | `connector.go` | Same cloud key | Remote Integration via Site Manager proxy |
| `ClassicClient` | `classic.go` | Cookie + CSRF | LED locate only (Integration gap) |
| `RollbackVerifier` | `verify.go` | Uses `NetworkClient` | Post-SSH rollback firmware check |

## Locate strategy

The official Network Integration OpenAPI documents **RESTART** as the only device
action. **LOCATE is not available** on Integration endpoints as of Network 10.3.58.

For LED locate, use `ClassicClient.SetLocate` / `UnsetLocate`, which call:

```
POST /proxy/network/api/s/{site}/cmd/devmgr
{"cmd":"set-locate","mac":"aa:bb:cc:dd:ee:ff"}
```

Requirements:

- Local admin username/password (not SSO)
- Direct LAN/HTTPS access to the console
- Optional: evaluate Connector Proxy → classic path in a future iteration

Do **not** assume `POST .../actions` with `LOCATE` until Ubiquiti adds it to the OpenAPI spec.

## Official references

- [Site Manager OpenAPI](https://developer.ui.com/site-manager/v1.0.0/openapi.json)
- [Network Integration OpenAPI](https://developer.ui.com/network/v10.3.58/openapi.json)
- [Classic API reference (community wiki)](https://www.ubntwiki.com/products/software/unifi-controller/api)
