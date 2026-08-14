import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/types/ai-chat"
import { Bot, User } from "lucide-react"

type AiChatMessageProps = {
  message: ChatMessage
}

export function AiChatMessage({ message }: AiChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse text-right" : "flex-row text-left"
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-[color-mix(in_srgb,var(--unifi-blue)_15%,var(--unifi-surface))] text-[var(--unifi-blue)]"
            : "bg-muted text-[var(--unifi-text-muted)]"
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-[color-mix(in_srgb,var(--unifi-blue)_12%,var(--unifi-surface))] text-[var(--unifi-text)]"
            : "border border-[var(--unifi-border)] bg-[var(--unifi-surface)] text-[var(--unifi-text)]"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}

type AiChatTypingIndicatorProps = {
  visible: boolean
}

export function AiChatTypingIndicator({ visible }: AiChatTypingIndicatorProps) {
  if (!visible) return null

  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[var(--unifi-text-muted)]">
        <Bot className="size-3.5" />
      </div>
      <div className="flex items-center gap-1 rounded-xl border border-[var(--unifi-border)] bg-[var(--unifi-surface)] px-3 py-2">
        <span className="ai-chat-dot size-1.5 rounded-full bg-[var(--unifi-text-muted)]" />
        <span className="ai-chat-dot ai-chat-dot-delay-1 size-1.5 rounded-full bg-[var(--unifi-text-muted)]" />
        <span className="ai-chat-dot ai-chat-dot-delay-2 size-1.5 rounded-full bg-[var(--unifi-text-muted)]" />
      </div>
    </div>
  )
}
