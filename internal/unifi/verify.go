package unifi

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// ErrRollbackVerifyTimeout is returned when firmware version does not match within the poll window.
var ErrRollbackVerifyTimeout = errors.New("firmware version verification timed out")

// RollbackVerifyOptions configures post-rollback firmware polling.
type RollbackVerifyOptions struct {
	// Interval between polls. Default 10s.
	Interval time.Duration
	// Timeout for the entire wait. Default 10m.
	Timeout time.Duration
	// OnPoll is called after each poll with the current reported version.
	OnPoll func(reported string)
}

// RollbackVerifier polls Network Integration API until a device reports the expected firmware.
type RollbackVerifier struct {
	client *NetworkClient
}

// NewRollbackVerifier creates a verifier backed by a NetworkClient.
func NewRollbackVerifier(client *NetworkClient) *RollbackVerifier {
	if client == nil {
		panic("unifi: NetworkClient is nil")
	}
	return &RollbackVerifier{client: client}
}

// WaitForFirmwareVersion polls GET .../devices/{deviceId} until firmwareVersion equals wantVersion
// or the timeout elapses. Useful after SSH rollback (SPEC §7.3).
func (v *RollbackVerifier) WaitForFirmwareVersion(
	ctx context.Context,
	siteID, deviceID, wantVersion string,
	opts RollbackVerifyOptions,
) error {
	if wantVersion == "" {
		return fmt.Errorf("wantVersion is required")
	}

	interval := opts.Interval
	if interval <= 0 {
		interval = 10 * time.Second
	}
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Minute
	}

	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		device, err := v.client.GetDevice(ctx, siteID, deviceID)
		if err == nil {
			if opts.OnPoll != nil {
				opts.OnPoll(device.FirmwareVersion)
			}
			if device.FirmwareVersion == wantVersion {
				return nil
			}
		}

		if time.Now().After(deadline) {
			if err != nil {
				return fmt.Errorf("%w: last error: %v", ErrRollbackVerifyTimeout, err)
			}
			return fmt.Errorf("%w: last reported %q, want %q", ErrRollbackVerifyTimeout, device.FirmwareVersion, wantVersion)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

// VerifyFirmwareVersion performs a single check (no polling).
func (v *RollbackVerifier) VerifyFirmwareVersion(ctx context.Context, siteID, deviceID, wantVersion string) (bool, string, error) {
	device, err := v.client.GetDevice(ctx, siteID, deviceID)
	if err != nil {
		return false, "", err
	}
	return device.FirmwareVersion == wantVersion, device.FirmwareVersion, nil
}
