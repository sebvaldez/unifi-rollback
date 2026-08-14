import { Button } from "@/components/ui/button"
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  readSettingsSidebarCollapsed,
  writeSettingsSidebarCollapsed,
  type SettingsSection,
  type SettingsSectionId,
} from "@/types/settings-navigation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useCallback, useState, type ReactNode } from "react"

type SettingsLayoutProps = {
  sections: SettingsSection[]
  activeSection: SettingsSectionId
  onSectionChange: (section: SettingsSectionId) => void
  children: ReactNode
}

function NavButton({
  section,
  active,
  collapsed,
  onSelect,
}: {
  section: SettingsSection
  active: boolean
  collapsed: boolean
  onSelect: () => void
}) {
  const Icon = section.icon
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
      {!collapsed ? <span className="truncate">{section.label}</span> : null}
    </button>
  )

  if (!collapsed) return button

  return (
    <Tooltip content={section.label} side="right">
      {button}
    </Tooltip>
  )
}

export function SettingsLayout({
  sections,
  activeSection,
  onSectionChange,
  children,
}: SettingsLayoutProps) {
  const [collapsed, setCollapsed] = useState(readSettingsSidebarCollapsed)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      writeSettingsSidebarCollapsed(next)
      return next
    })
  }, [])

  const activeMeta =
    sections.find((section) => section.id === activeSection) ?? sections[0]

  return (
    <TooltipProvider>
      <div className="-m-6 flex min-h-[calc(100vh-3.5rem)]">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-[var(--unifi-border)] bg-[var(--unifi-surface)] transition-[width] duration-200",
            collapsed ? "w-14" : "w-52"
          )}
        >
          {!collapsed ? (
            <div className="border-b border-[var(--unifi-border)] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--unifi-text-muted)]">
                Settings
              </p>
            </div>
          ) : null}

          <nav className="flex flex-1 flex-col gap-1 p-2">
            {sections.map((section) => (
              <NavButton
                key={section.id}
                section={section}
                active={section.id === activeSection}
                collapsed={collapsed}
                onSelect={() => onSectionChange(section.id)}
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
                  aria-label="Expand settings sidebar"
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

        <div className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl space-y-1 p-6">
            {activeMeta ? (
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--unifi-text)]">
                  {activeMeta.label}
                </h2>
                <p className="text-sm text-[var(--unifi-text-muted)]">
                  {activeMeta.description}
                </p>
              </header>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
