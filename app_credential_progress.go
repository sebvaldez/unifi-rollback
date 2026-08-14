package main

import (
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const credentialValidationProgressEvent = "credential-validation-progress"

// CredentialValidationStep is one step in a credential save/validate flow.
type CredentialValidationStep struct {
	Label  string `json:"label"`
	Target string `json:"target,omitempty"`
	Status string `json:"status"` // pending, active, complete, skipped, error
}

// CredentialValidationProgressEvent is emitted to the frontend during validation.
type CredentialValidationProgressEvent struct {
	SlotID string                     `json:"slotId"`
	Phase  string                     `json:"phase"` // running, done, error
	Steps  []CredentialValidationStep `json:"steps"`
}

type credentialProgressTracker struct {
	app    *App
	slotID string
	steps  []CredentialValidationStep
}

func (a *App) newCredentialProgressTracker(slotID string) *credentialProgressTracker {
	tracker := &credentialProgressTracker{app: a, slotID: slotID}
	tracker.emit("running")
	return tracker
}

func (t *credentialProgressTracker) step(label, target string) {
	for i := range t.steps {
		if t.steps[i].Status == "active" {
			t.steps[i].Status = "complete"
		}
	}
	t.steps = append(t.steps, CredentialValidationStep{
		Label:  label,
		Target: target,
		Status: "active",
	})
	t.emit("running")
}

func (t *credentialProgressTracker) skip(label, target string) {
	for i := range t.steps {
		if t.steps[i].Status == "active" {
			t.steps[i].Status = "complete"
		}
	}
	t.steps = append(t.steps, CredentialValidationStep{
		Label:  label,
		Target: target,
		Status: "skipped",
	})
	t.emit("running")
}

func (t *credentialProgressTracker) done() {
	for i := range t.steps {
		switch t.steps[i].Status {
		case "active":
			t.steps[i].Status = "complete"
		case "pending":
			t.steps[i].Status = "skipped"
		}
	}
	t.emit("done")
}

func (t *credentialProgressTracker) fail() {
	for i := range t.steps {
		if t.steps[i].Status == "active" {
			t.steps[i].Status = "error"
			break
		}
	}
	t.emit("error")
}

func (t *credentialProgressTracker) probeReporter() func(label, target string) {
	return func(label, target string) {
		t.step(label, target)
	}
}

func (t *credentialProgressTracker) emit(phase string) {
	if t.app == nil || t.app.ctx == nil {
		return
	}
	runtime.EventsEmit(t.app.ctx, credentialValidationProgressEvent, CredentialValidationProgressEvent{
		SlotID: t.slotID,
		Phase:  phase,
		Steps:  append([]CredentialValidationStep(nil), t.steps...),
	})
}

func (a *App) clearCredentialProgress(slotID string) {
	if a == nil || a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, credentialValidationProgressEvent, CredentialValidationProgressEvent{
		SlotID: slotID,
		Phase:  "done",
		Steps:  nil,
	})
}
