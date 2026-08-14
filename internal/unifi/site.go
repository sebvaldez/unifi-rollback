package unifi

import "strings"

// SiteNameFromMeta extracts the human-readable site name from Site Manager meta.
func SiteNameFromMeta(meta map[string]any) string {
	if meta == nil {
		return ""
	}
	if name, ok := meta["name"].(string); ok {
		return strings.TrimSpace(name)
	}
	return ""
}

// SiteDisplayName returns the best display label for a Site Manager site record.
func SiteDisplayName(site Site) string {
	if name := SiteNameFromMeta(site.Meta); name != "" {
		return name
	}
	return strings.TrimSpace(site.SiteID)
}

// ResolveSiteDisplayName picks a user-facing site label, avoiding raw host IDs.
func ResolveSiteDisplayName(siteID, preferredName, storedLabel string) string {
	if name := strings.TrimSpace(preferredName); name != "" && !LooksLikeHostID(name) {
		return name
	}
	if name := strings.TrimSpace(storedLabel); name != "" && !LooksLikeHostID(name) {
		return name
	}
	return ShortHostLabel(siteID)
}
