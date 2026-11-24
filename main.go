package main

import (
	"embed"
	"io/fs"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	dist, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		println("Error:", err.Error())
		return
	}

	wailsApp := application.New(application.Options{
		Name:        "unifi-rollback",
		Description: "UniFi Fleet Firmware Manager",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(dist),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	wailsApp.RegisterService(application.NewService(NewApp(wailsApp)))

	wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "UniFi Fleet Firmware Manager",
		Width:            1280,
		Height:           800,
		MinWidth:         960,
		MinHeight:        600,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	if err := wailsApp.Run(); err != nil {
		println("Error:", err.Error())
	}
}
