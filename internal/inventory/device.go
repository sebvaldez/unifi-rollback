package inventory

// DeviceCapabilities mirrors the frontend DeviceCapabilities type.
type DeviceCapabilities struct {
	Inventory bool `json:"inventory"`
	Restart   bool `json:"restart"`
	Locate    bool `json:"locate"`
	Rollback  bool `json:"rollback"`
}

// Device is the Wails-facing device DTO (matches frontend/src/types/inventory.ts).
type Device struct {
	ID           string             `json:"id"`
	SiteID       string             `json:"siteId"`
	Name         string             `json:"name"`
	Model        string             `json:"model"`
	Firmware     string             `json:"firmware"`
	Status       string             `json:"status"`
	Site         string             `json:"site"`
	Mac          string             `json:"mac,omitempty"`
	IconURL      string             `json:"iconUrl,omitempty"`
	InScope      bool               `json:"inScope"`
	ScopeLostAt  string             `json:"scopeLostAt,omitempty"`
	Capabilities DeviceCapabilities `json:"capabilities"`
}
