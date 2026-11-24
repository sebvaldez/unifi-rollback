package main

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestCredentialProgressFirstEventHasEmptyStepsArray(t *testing.T) {
	wails := application.New(application.Options{Name: "test"})
	got := make(chan []byte, 1)
	wails.Event.On(credentialValidationProgressEvent, func(event *application.CustomEvent) {
		raw, err := json.Marshal(event.Data)
		if err != nil {
			t.Errorf("marshal event data: %v", err)
		}
		got <- raw
	})

	NewApp(wails).newCredentialProgressTracker("slot")

	select {
	case raw := <-got:
		var payload struct {
			Steps *[]CredentialValidationStep `json:"steps"`
		}
		if err := json.Unmarshal(raw, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Steps == nil {
			t.Fatalf("steps serialized as null, frontend reads steps.length: %s", raw)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("no event emitted")
	}
}
