package main

import "testing"

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
