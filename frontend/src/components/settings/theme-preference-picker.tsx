import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { ThemePreference } from "@/lib/theme"
import { Monitor, Moon, Sun } from "lucide-react"

const options: {
  value: ThemePreference
  label: string
  icon: typeof Sun
}[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
]

export function ThemePreferencePicker() {
  const { preference, setPreference } = useTheme()

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ value, label, icon: Icon }) => {
        const active = preference === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-[color-mix(in_srgb,var(--unifi-blue)_12%,var(--unifi-surface))] text-primary"
                : "border-[var(--unifi-border)] bg-[var(--unifi-surface)] text-[var(--unifi-text-muted)] hover:text-[var(--unifi-text)]"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
