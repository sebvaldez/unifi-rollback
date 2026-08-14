import { AiChatMessage, AiChatTypingIndicator } from "@/components/ai/ai-chat-message"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { AiChatController } from "@/hooks/use-ai-chat"
import { AI_CHAT_SUGGESTIONS } from "@/types/ai-chat"
import { ArrowUp, Sparkles, Trash2 } from "lucide-react"
import { useEffect, useRef, type KeyboardEvent } from "react"

type AiAssistantSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  chat: AiChatController
}

export function AiAssistantSheet({
  open,
  onOpenChange,
  chat,
}: AiAssistantSheetProps) {
  const {
    messages,
    input,
    isGenerating,
    error,
    setInput,
    sendMessage,
    submit,
    stop,
    clear,
  } = chat

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isGenerating])

  useEffect(() => {
    if (open) {
      window.setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (isGenerating) {
        stop()
      } else {
        submit()
      }
    }
  }

  const showSuggestions = messages.length === 0 && !isGenerating

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-[var(--unifi-border)] px-4 py-4 pr-12">
          <div className="flex items-center gap-2">
            <Sparkles className="ai-assistant-sparkle size-4 text-[var(--unifi-blue)]" />
            <SheetTitle>AI Assistant</SheetTitle>
          </div>
          <SheetDescription>
            Ask about firmware safety, community threads, and rollback planning.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
            {showSuggestions ? (
              <div className="space-y-3 py-6">
                <p className="text-center text-sm text-[var(--unifi-text-muted)]">
                  Start a conversation or try a suggestion
                </p>
                <div className="flex flex-col gap-2">
                  {AI_CHAT_SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start whitespace-normal px-3 py-2 text-left text-sm font-normal"
                      onClick={() => void sendMessage(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <AiChatMessage key={message.id} message={message} />
            ))}

            <AiChatTypingIndicator visible={isGenerating} />
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-[var(--unifi-border)] bg-[var(--unifi-surface)] p-4">
          {error ? (
            <p className="mb-2 text-sm text-destructive">{error}</p>
          ) : null}

          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about firmware, devices, or community threads…"
              rows={3}
              disabled={isGenerating}
              className="min-h-[88px] resize-none pr-12"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {messages.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Clear conversation"
                  aria-label="Clear conversation"
                  onClick={clear}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon-sm"
                title={isGenerating ? "Stop" : "Send message"}
                aria-label={isGenerating ? "Stop generating" : "Send message"}
                disabled={!isGenerating && !input.trim()}
                onClick={() => (isGenerating ? stop() : submit())}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--unifi-text-muted)]">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
