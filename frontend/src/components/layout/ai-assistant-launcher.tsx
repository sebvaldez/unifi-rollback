import { AiAssistantSheet } from "@/components/ai/ai-assistant-sheet"
import { Button } from "@/components/ui/button"
import { useAiChat } from "@/hooks/use-ai-chat"
import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"
import { useState } from "react"

type AiAssistantLauncherProps = {
  className?: string
}

export function AiAssistantLauncher({ className }: AiAssistantLauncherProps) {
  const [open, setOpen] = useState(false)
  const chat = useAiChat()

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        title="Open AI assistant"
        aria-label="Open AI assistant"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "ai-assistant-button gap-2 border-[color-mix(in_srgb,var(--unifi-blue)_25%,var(--unifi-border))] text-[var(--unifi-text-muted)] hover:text-[var(--unifi-text)]",
          open &&
            "border-[color-mix(in_srgb,var(--unifi-blue)_35%,var(--unifi-border))] bg-[color-mix(in_srgb,var(--unifi-blue)_8%,var(--unifi-surface))] text-[var(--unifi-blue)]",
          className
        )}
      >
        <Sparkles className="ai-assistant-sparkle size-4 text-[var(--unifi-blue)]" />
        <span className="hidden sm:inline">AI</span>
      </Button>

      <AiAssistantSheet open={open} onOpenChange={setOpen} chat={chat} />
    </>
  )
}
