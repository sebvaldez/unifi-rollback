package unifi

import "testing"

func TestSiteDisplayName(t *testing.T) {
	t.Parallel()

	site := Site{
		SiteID: "661de833b6b2463f0c20b319",
		Meta:   map[string]any{"name": "Home Office"},
	}
	if got := SiteDisplayName(site); got != "Home Office" {
		t.Fatalf("SiteDisplayName() = %q, want Home Office", got)
	}
}

func TestResolveSiteDisplayName(t *testing.T) {
	t.Parallel()

	hostID := "D8B37056228A00000000000786AC8500000000007E3FD94000000000646BD358:1119592750"
	if got := ResolveSiteDisplayName(hostID, "CoastMesh", hostID); got != "CoastMesh" {
		t.Fatalf("ResolveSiteDisplayName() = %q, want CoastMesh", got)
	}
	if got := ResolveSiteDisplayName(hostID, hostID, ""); got != "Console …6BD358" {
		t.Fatalf("ResolveSiteDisplayName() = %q, want abbreviated console label", got)
	}
}
