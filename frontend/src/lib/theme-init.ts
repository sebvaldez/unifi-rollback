import {
  applyTheme,
  getStoredThemePreference,
  getSystemTheme,
  resolveTheme,
} from "@/lib/theme"

applyTheme(resolveTheme(getStoredThemePreference(), getSystemTheme()))
