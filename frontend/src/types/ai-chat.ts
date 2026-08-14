export type ChatRole = "user" | "assistant" | "system"

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: Date
}

export const AI_CHAT_SUGGESTIONS = [
  "Is this firmware version safe to install?",
  "Summarize the community release thread",
  "Which devices need a firmware rollback?",
] as const
