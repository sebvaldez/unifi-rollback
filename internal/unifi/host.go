package unifi

import (
	"regexp"
	"strings"
)

var hostIDPattern = regexp.MustCompile(`^[0-9A-Fa-f]{16,}:[0-9]+$`)

// HostReportedState is the console-reported identity from GET /v1/hosts.
type HostReportedState struct {
	Name     string `json:"name"`
	Hostname string `json:"hostname"`
}

// LooksLikeHostID reports whether value matches Site Manager hostId format (hex:timestamp).
func LooksLikeHostID(value string) bool {
	value = strings.TrimSpace(value)
	return value != "" && hostIDPattern.MatchString(value)
}

// HostDisplayName returns a human-readable console label from host metadata.
func HostDisplayName(host Host) string {
	if host.ReportedState != nil {
		if name := strings.TrimSpace(host.ReportedState.Name); name != "" && !LooksLikeHostID(name) {
			return name
		}
		if hostname := strings.TrimSpace(host.ReportedState.Hostname); hostname != "" && !LooksLikeHostID(hostname) {
			return hostname
		}
	}
	return ""
}

// ShortHostLabel abbreviates a hostId for display when no friendly name exists.
func ShortHostLabel(hostID string) string {
	hostID = strings.TrimSpace(hostID)
	if hostID == "" {
		return "Unknown site"
	}
	if !LooksLikeHostID(hostID) {
		return hostID
	}
	before, _, ok := strings.Cut(hostID, ":")
	if !ok {
		return hostID
	}
	if len(before) <= 8 {
		return "Console " + before
	}
	return "Console …" + before[len(before)-6:]
}
