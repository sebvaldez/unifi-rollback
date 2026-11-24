//go:build !production

package main

import "os"

func wailsDevSession() bool {
	return os.Getenv("FRONTEND_DEVSERVER_URL") != ""
}
