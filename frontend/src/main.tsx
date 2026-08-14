import React from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "@/components/theme-provider"
import { CredentialCapabilitiesBridge } from "@/components/devices/credential-capabilities-bridge"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DeviceSettingsProvider } from "@/context/device-settings-context"
import { DeviceInventoryProvider } from "@/context/device-inventory-context"
import { CredentialsProvider } from "@/context/credentials-context"
import "@/lib/theme-init"
import "./index.css"
import App from "./App"

const container = document.getElementById("root")
const root = createRoot(container!)

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <CredentialsProvider>
          <DeviceSettingsProvider>
            <DeviceInventoryProvider>
              <CredentialCapabilitiesBridge />
              <App />
            </DeviceInventoryProvider>
          </DeviceSettingsProvider>
        </CredentialsProvider>
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>
)
