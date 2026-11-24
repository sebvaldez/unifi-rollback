package inventory_test

import (
	"testing"

	"unifi-rollback/internal/inventory"
	"unifi-rollback/internal/unifi"
)

func TestMergeFleetInventory(t *testing.T) {
	t.Parallel()

	sites := []unifi.Site{{
		SiteID: "site-home",
		HostID: "host-1",
		Meta:   map[string]any{"name": "Home Office"},
	}}
	groups := []unifi.HostDeviceGroup{{
		HostID:   "host-1",
		HostName: "udm.local",
		Devices: []unifi.SiteManagerDevice{{
			ID:        "dev-1",
			MAC:       "aa:bb:cc:dd:ee:01",
			Name:      "Hall AP",
			Model:     "U7-Pro-XGS",
			Status:    "online",
			Version:   "7.0.102",
			IsManaged: true,
		}},
	}}

	devices := inventory.MergeFleetInventory(sites, nil, groups)
	if len(devices) != 1 {
		t.Fatalf("len(devices) = %d, want 1", len(devices))
	}

	device := devices[0]
	if device.SiteID != "site-home" {
		t.Fatalf("SiteID = %q, want site-home", device.SiteID)
	}
	if device.Site != "Home Office" {
		t.Fatalf("Site = %q, want Home Office", device.Site)
	}
	if device.Status != "online" {
		t.Fatalf("Status = %q, want online", device.Status)
	}
}

func TestMergeFleetInventory_UsesHostReportedNameWhenSiteMissing(t *testing.T) {
	t.Parallel()

	hostID := "D8B37056228A00000000000786AC8500000000007E3FD94000000000646BD358:1119592750"
	hosts := []unifi.Host{{
		ID: hostID,
		ReportedState: &unifi.HostReportedState{
			Name: "CoastMesh Drive",
		},
	}}
	groups := []unifi.HostDeviceGroup{{
		HostID: hostID,
		Devices: []unifi.SiteManagerDevice{{
			ID: "cam-1", MAC: "aa:bb:cc:dd:ee:01", Name: "Balcony", Model: "G6 PTZ",
			Status: "online", Version: "5.4.122", IsManaged: true,
		}},
	}}

	devices := inventory.MergeFleetInventory(nil, hosts, groups)
	if len(devices) != 1 {
		t.Fatalf("len(devices) = %d, want 1", len(devices))
	}
	if devices[0].Site != "CoastMesh Drive" {
		t.Fatalf("Site = %q, want CoastMesh Drive", devices[0].Site)
	}
	if unifi.LooksLikeHostID(devices[0].Site) {
		t.Fatalf("Site should not be a raw hostId: %q", devices[0].Site)
	}
}

func TestMergeFleetInventory_UnmanagedDevice(t *testing.T) {
	t.Parallel()

	groups := []unifi.HostDeviceGroup{{
		HostID: "host-orphan",
		Devices: []unifi.SiteManagerDevice{{
			ID:        "dev-2",
			MAC:       "aa:bb:cc:dd:ee:02",
			IsManaged: false,
			Status:    "offline",
		}},
	}}

	devices := inventory.MergeFleetInventory(nil, nil, groups)
	if len(devices) != 1 {
		t.Fatalf("len(devices) = %d, want 1", len(devices))
	}
	if devices[0].Status != "offline" {
		t.Fatalf("Status = %q, want offline", devices[0].Status)
	}
}

func TestMergeFleetInventory_AdoptingWhenUnmanaged(t *testing.T) {
	t.Parallel()

	groups := []unifi.HostDeviceGroup{{
		HostID: "host-1",
		Devices: []unifi.SiteManagerDevice{{
			ID:        "dev-3",
			MAC:       "aa:bb:cc:dd:ee:03",
			IsManaged: false,
			Status:    "connected",
		}},
	}}

	devices := inventory.MergeFleetInventory(nil, nil, groups)
	if devices[0].Status != "adopting" {
		t.Fatalf("Status = %q, want adopting", devices[0].Status)
	}
}

func TestConsoleIPsBySite(t *testing.T) {
	t.Parallel()

	sites := []unifi.Site{
		{SiteID: "site-a", HostID: "host-a"},
		{SiteID: "site-b", HostID: "host-b"},
	}
	hosts := []unifi.Host{
		{ID: "host-a", IPAddress: " 203.0.113.7 "},
		{ID: "host-b"},
	}
	groups := []unifi.HostDeviceGroup{
		{HostID: "host-a", Devices: []unifi.SiteManagerDevice{{IsConsole: true, IP: "10.0.0.1"}}},
		{HostID: "host-b", Devices: []unifi.SiteManagerDevice{
			{IsConsole: false, IP: "10.1.0.50"},
			{IsConsole: true, IP: "10.1.0.1"},
		}},
		{HostID: "host-no-site", Devices: []unifi.SiteManagerDevice{{IsConsole: true, IP: "10.2.0.1"}}},
		{HostID: "host-empty", Devices: []unifi.SiteManagerDevice{{IsConsole: true}}},
	}

	got := inventory.ConsoleIPsBySite(sites, hosts, groups)
	want := map[string]string{
		"site-a":       "203.0.113.7",
		"site-b":       "10.1.0.1",
		"host-no-site": "10.2.0.1",
	}
	if len(got) != len(want) {
		t.Fatalf("ConsoleIPsBySite() = %v, want %v", got, want)
	}
	for siteID, ip := range want {
		if got[siteID] != ip {
			t.Fatalf("ConsoleIPsBySite()[%q] = %q, want %q", siteID, got[siteID], ip)
		}
	}
}
