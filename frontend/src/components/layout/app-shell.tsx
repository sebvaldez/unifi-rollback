import { AiAssistantLauncher } from "@/components/layout/ai-assistant-launcher"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  readAppSidebarCollapsed,
  writeAppSidebarCollapsed,
} from "@/types/navigation"
import {
  HardDriveDownload,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Router,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useState, type ReactNode } from "react"

type NavItem = {
  id: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: "devices", label: "Devices", icon: Router },
  { id: "firmware", label: "Firmware", icon: HardDriveDownload },
  { id: "settings", label: "Settings", icon: Settings },
]

type AppShellProps = {
  activeNav: string
  onNavChange: (id: string) => void
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

function MainNavButton({
  item,
  active,
  collapsed,
  onSelect,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onSelect: () => void
}) {
  const Icon = item.icon
  const button = (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center rounded-md text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
        active
          ? "bg-[var(--unifi-nav-active-bg)] text-[var(--unifi-blue)]"
          : "text-[var(--unifi-text-muted)] hover:bg-muted hover:text-[var(--unifi-text)]"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </button>
  )

  if (!collapsed) return button

  return (
    <Tooltip content={item.label} side="right">
      {button}
    </Tooltip>
  )
}

export function AppShell({
  activeNav,
  onNavChange,
  title,
  description,
  actions,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(readAppSidebarCollapsed)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      writeAppSidebarCollapsed(next)
      return next
    })
  }, [])

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-[var(--unifi-bg)]">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-[var(--unifi-border)] bg-[var(--unifi-surface)] transition-[width] duration-200",
            collapsed ? "w-14" : "w-56"
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center border-b border-[var(--unifi-border)]",
              collapsed ? "justify-center px-2" : "gap-2 px-4"
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--unifi-text)]">
                  Fleet Manager
                </p>
                <p className="truncate text-xs text-[var(--unifi-text-muted)]">
                  UniFi Firmware
                </p>
              </div>
            ) : null}
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-2">
            {navItems.map((item) => (
              <MainNavButton
                key={item.id}
                item={item}
                active={activeNav === item.id}
                collapsed={collapsed}
                onSelect={() => onNavChange(item.id)}
              />
            ))}
          </nav>

          <div className="border-t border-[var(--unifi-border)] p-2">
            {collapsed ? (
              <Tooltip content="Expand sidebar" side="right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="w-full"
                  aria-label="Expand sidebar"
                  onClick={toggleCollapsed}
                >
                  <PanelLeftOpen className="size-4" />
                </Button>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-[var(--unifi-text-muted)]"
                onClick={toggleCollapsed}
              >
                <PanelLeftClose className="size-4 shrink-0" />
                Collapse
              </Button>
            )}
          </div>
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
    </TooltipProvider>
  )
}

export { RefreshCw }
