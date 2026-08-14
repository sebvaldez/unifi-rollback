import type { LucideIcon } from "lucide-react"
import {
  Database,
  KeyRound,
  Palette,
  RefreshCw,
  Wrench,
} from "lucide-react"

export type SettingsSectionId =
  | "appearance"
  | "credentials"
  | "inventory"
  | "database"
  | "developer"

export type SettingsSection = {
  id: SettingsSectionId
  label: string
  description: string
  icon: LucideIcon
  devOnly?: boolean
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "credentials",
    label: "Credentials",
    description: "API keys stored in macOS Keychain",
    icon: KeyRound,
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Device list refresh behavior",
    icon: RefreshCw,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme and display preferences",
    icon: Palette,
  },
  {
    id: "database",
    label: "Database",
    description: "Local SQLite storage",
    icon: Database,
  },
  {
    id: "developer",
    label: "Developer",
    description: "Keychain dev tools",
    icon: Wrench,
    devOnly: true,
  },
]

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = "credentials"

const SECTION_STORAGE_KEY = "settings-active-section"
const SIDEBAR_COLLAPSED_KEY = "settings-sidebar-collapsed"

export function readStoredSettingsSection(): SettingsSectionId {
  if (typeof window === "undefined") return DEFAULT_SETTINGS_SECTION
  const stored = window.localStorage.getItem(SECTION_STORAGE_KEY)
  if (
    stored === "appearance" ||
    stored === "credentials" ||
    stored === "inventory" ||
    stored === "database" ||
    stored === "developer"
  ) {
    return stored
  }
  return DEFAULT_SETTINGS_SECTION
}

export function writeStoredSettingsSection(section: SettingsSectionId): void {
  window.localStorage.setItem(SECTION_STORAGE_KEY, section)
}

export function readSettingsSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
}

export function writeSettingsSidebarCollapsed(collapsed: boolean): void {
  if (collapsed) {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true")
  } else {
    window.localStorage.removeItem(SIDEBAR_COLLAPSED_KEY)
  }
}

export function visibleSettingsSections(devMode: boolean): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => !section.devOnly || devMode)
}
