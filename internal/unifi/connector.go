package unifi

import (
	"fmt"
	"net/http"
	"net/url"
)

const connectorProxyPrefix = "/connector/consoles"

// NewNetworkClientViaConnector returns a Network Integration client routed through the
// Site Manager Connector Proxy. Requires console UniFi OS firmware >= 5.0.3.
//
// Example proxied path:
//
//	https://api.ui.com/v1/connector/consoles/{consoleId}/proxy/network/integration/v1/sites/...
func NewNetworkClientViaConnector(sm *SiteManagerClient, consoleID string) *NetworkClient {
	return NewNetworkClientViaConnectorWithKey(sm, consoleID, sm.APIKey())
}

// NewNetworkClientViaConnectorWithKey routes Integration requests through Connector Proxy
// using apiKey (typically a per-site Network Integration key).
func NewNetworkClientViaConnectorWithKey(sm *SiteManagerClient, consoleID, apiKey string) *NetworkClient {
	if sm == nil {
		panic("unifi: SiteManagerClient is nil")
	}
	consoleID = url.PathEscape(consoleID)
	base := fmt.Sprintf("%s%s/%s/proxy/network/integration/v1",
		stringsTrimRightSlash(sm.BaseURL()),
		connectorProxyPrefix,
		consoleID,
	)
	return &NetworkClient{
		client: newAPIClient(base, apiKey, sm.client.http),
	}
}

// NewNetworkClientViaConnectorWithHTTP is like NewNetworkClientViaConnector but allows a custom HTTP client.
func NewNetworkClientViaConnectorWithHTTP(sm *SiteManagerClient, consoleID string, httpClient *http.Client) *NetworkClient {
	if sm == nil {
		panic("unifi: SiteManagerClient is nil")
	}
	clone := NewSiteManagerClientWithBase(sm.BaseURL(), sm.APIKey(), httpClient)
	return NewNetworkClientViaConnector(clone, consoleID)
}
