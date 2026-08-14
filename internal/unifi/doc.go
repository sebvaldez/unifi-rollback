// Package unifi provides HTTP clients for Ubiquiti UniFi APIs used by Fleet Manager.
//
// Supported surfaces:
//   - Site Manager (cloud): fleet inventory via api.ui.com/v1
//   - Network Integration (local or Connector Proxy): per-site device detail and actions
//   - Classic Controller (optional): LED locate via cookie session — see classic.go
//
// Official docs: https://developer.ui.com
package unifi
