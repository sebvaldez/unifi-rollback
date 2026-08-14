package main

import (
	"database/sql"
	"encoding/json"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestNetworkKeyValidationWarning(t *testing.T) {
	t.Parallel()

	if w := networkKeyValidationWarning(unifi.NetworkKeyProbe{NetworkKeyVerified: true}); w != "" {
		t.Fatalf("verified warning = %q, want empty", w)
	}
	if w := networkKeyValidationWarning(unifi.NetworkKeyProbe{NetworkKeyVerified: false}); w == "" {
		t.Fatal("unverified warning should not be empty")
	}
}

func TestDecodeNetworkProbeSummaryRoundTrip(t *testing.T) {
	t.Parallel()

	probe := unifi.NetworkKeyProbe{
		ApplicationVersion: "10.3.58",
		NetworkSiteID:      "site-uuid",
		NetworkKeyVerified: false,
		DeviceCount:        3,
	}
	encoded := encodeNetworkProbeSummary(probe)
	decoded, err := decodeNetworkProbeSummary(encoded)
	if err != nil {
		t.Fatalf("decodeNetworkProbeSummary() error = %v", err)
	}
	if decoded == nil {
		t.Fatal("decodeNetworkProbeSummary() = nil, want probe")
	}
	if decoded.NetworkKeyVerified {
		t.Fatal("NetworkKeyVerified should round-trip as false")
	}
	if decoded.DeviceCount != 3 {
		t.Fatalf("DeviceCount = %d, want 3", decoded.DeviceCount)
	}

	if _, err := decodeNetworkProbeSummary(sql.NullString{}); err != nil {
		t.Fatalf("empty summary error = %v", err)
	}
	if _, err := decodeNetworkProbeSummary(sql.NullString{String: "{", Valid: true}); err == nil {
		t.Fatal("invalid JSON should error")
	}

	raw, _ := json.Marshal(probe)
	if _, err := decodeNetworkProbeSummary(sql.NullString{String: string(raw), Valid: true}); err != nil {
		t.Fatalf("valid JSON error = %v", err)
	}
}

func TestParseNetworkIntegrationSiteID(t *testing.T) {
	t.Parallel()

	tests := []struct {
		slotID string
		want   string
		ok     bool
	}{
		{"network-integration-default", "default", true},
		{"network-integration-site-1", "site-1", true},
		{"site-manager-primary", "", false},
		{"network-integration-", "", false},
	}

	for _, tc := range tests {
		got, ok := parseNetworkIntegrationSiteID(tc.slotID)
		if ok != tc.ok || got != tc.want {
			t.Fatalf("parseNetworkIntegrationSiteID(%q) = (%q, %v), want (%q, %v)", tc.slotID, got, ok, tc.want, tc.ok)
		}
	}
}

func TestDedupeDiscoveredSites(t *testing.T) {
	t.Parallel()

	sites := dedupeDiscoveredSites([]DiscoveredSite{
		{SiteID: "default", SiteName: "Default"},
		{SiteID: "default", SiteName: "Default Site"},
		{SiteID: "lab", SiteName: "Lab"},
		{SiteID: " ", SiteName: "Ignored"},
	})

	if len(sites) != 2 {
		t.Fatalf("len(sites) = %d, want 2", len(sites))
	}

	for _, site := range sites {
		if site.SiteID == "default" && site.SiteName != "Default Site" {
			t.Fatalf("default site name = %q, want Default Site", site.SiteName)
		}
	}
}

func TestNetworkSlotRank(t *testing.T) {
	t.Parallel()

	configured := CredentialSlot{Status: "configured"}
	unconfigured := CredentialSlot{Status: "unconfigured"}
	if networkSlotRank(configured) <= networkSlotRank(unconfigured) {
		t.Fatal("configured slot should outrank unconfigured slot")
	}
}
