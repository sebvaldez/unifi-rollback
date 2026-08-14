import React from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "@/components/theme-provider"
import { DeviceSettingsProvider } from "@/context/device-settings-context"
import "@/lib/theme-init"
import "./index.css"
import App from "./App"

const container = document.getElementById("root")
const root = createRoot(container!)

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <DeviceSettingsProvider>
        <App />
      </DeviceSettingsProvider>
    </ThemeProvider>
  </React.StrictMode>
)
