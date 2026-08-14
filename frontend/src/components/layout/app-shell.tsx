import { AiAssistantLauncher } from "@/components/layout/ai-assistant-launcher"
import { cn } from "@/lib/utils"
import {
  HardDriveDownload,
  LayoutGrid,
  RefreshCw,
  Router,
  Settings,
} from "lucide-react"
import type { ReactNode } from "react"

type NavItem = {
  id: string
  label: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  { id: "devices", label: "Devices", icon: <Router className="size-4" /> },
  {
    id: "firmware",
    label: "Firmware",
    icon: <HardDriveDownload className="size-4" />,
  },
  { id: "settings", label: "Settings", icon: <Settings className="size-4" /> },
]

type AppShellProps = {
  activeNav: string
  onNavChange: (id: string) => void
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({
  activeNav,
  onNavChange,
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--unifi-bg)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--unifi-border)] bg-[var(--unifi-surface)]">
        <div className="flex h-14 items-center gap-2 border-b border-[var(--unifi-border)] px-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LayoutGrid className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--unifi-text)]">
              Fleet Manager
            </p>
            <p className="truncate text-xs text-[var(--unifi-text-muted)]">
              UniFi Firmware
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = activeNav === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavChange(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--unifi-nav-active-bg)] text-[var(--unifi-blue)]"
                    : "text-[var(--unifi-text-muted)] hover:bg-muted hover:text-[var(--unifi-text)]"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-[var(--unifi-border)] bg-[var(--unifi-surface)] px-6">
          <div>
            <h1 className="text-base font-semibold text-[var(--unifi-text)]">
              {title}
            </h1>
            {description ? (
              <p className="text-xs text-[var(--unifi-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <AiAssistantLauncher />
            {actions}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}

export { RefreshCw }
