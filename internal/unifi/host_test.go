package unifi

import "testing"

func TestLooksLikeHostID(t *testing.T) {
	t.Parallel()

	cases := []struct {
		value string
		want  bool
	}{
		{"D8B37056228A00000000000786AC8500000000007E3FD94000000000646BD358:1119592750", true},
		{"site-home", false},
		{"661de833b6b2463f0c20b319", false},
		{"udm.local", false},
		{"", false},
	}

	for _, tc := range cases {
		if got := LooksLikeHostID(tc.value); got != tc.want {
			t.Errorf("LooksLikeHostID(%q) = %v, want %v", tc.value, got, tc.want)
		}
	}
}

func TestHostDisplayName(t *testing.T) {
	t.Parallel()

	host := Host{
		ID: "D8B37056228A00000000000786AC8500000000007E3FD94000000000646BD358:1119592750",
		ReportedState: &HostReportedState{
			Name: "CoastMesh Drive",
		},
	}
	if got := HostDisplayName(host); got != "CoastMesh Drive" {
		t.Fatalf("HostDisplayName() = %q, want CoastMesh Drive", got)
	}
}

func TestShortHostLabel(t *testing.T) {
	t.Parallel()

	got := ShortHostLabel("D8B37056228A00000000000786AC8500000000007E3FD94000000000646BD358:1119592750")
	if got != "Console …6BD358" {
		t.Fatalf("ShortHostLabel() = %q, want Console …6BD358", got)
	}
}
