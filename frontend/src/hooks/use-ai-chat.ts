import { useCallback, useReducer, useRef } from "react"
import type { ChatMessage } from "@/types/ai-chat"

type AiChatState = {
  messages: ChatMessage[]
  input: string
  isGenerating: boolean
  error: string | null
}

type AiChatAction =
  | { type: "setInput"; value: string }
  | { type: "appendMessage"; message: ChatMessage }
  | { type: "generateStart" }
  | { type: "generateEnd" }
  | { type: "setError"; error: string | null }
  | { type: "clear" }

function aiChatReducer(state: AiChatState, action: AiChatAction): AiChatState {
  switch (action.type) {
    case "setInput":
      return { ...state, input: action.value, error: null }
    case "appendMessage":
      return { ...state, messages: [...state.messages, action.message] }
    case "generateStart":
      return { ...state, isGenerating: true, error: null }
    case "generateEnd":
      return { ...state, isGenerating: false }
    case "setError":
      return { ...state, error: action.error, isGenerating: false }
    case "clear":
      return { ...state, messages: [], input: "", error: null }
    default:
      return state
  }
}

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date(),
  }
}

async function requestAssistantReply(prompt: string): Promise<string> {
  // TODO: wire to Wails LLM client on feat branch
  void prompt
  await new Promise((resolve) => setTimeout(resolve, 650))
  return "LLM chat is not connected yet. On the AI feature branch you'll be able to ask about firmware safety, community threads, and fleet rollbacks."
}

export function useAiChat() {
  const [state, dispatch] = useReducer(aiChatReducer, {
    messages: [],
    input: "",
    isGenerating: false,
    error: null,
  })
  const abortRef = useRef(false)

  const setInput = useCallback((value: string) => {
    dispatch({ type: "setInput", value })
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || state.isGenerating) return

    dispatch({ type: "appendMessage", message: createMessage("user", trimmed) })
    dispatch({ type: "setInput", value: "" })
    dispatch({ type: "generateStart" })
    abortRef.current = false

    try {
      const reply = await requestAssistantReply(trimmed)
      if (abortRef.current) return
      dispatch({
        type: "appendMessage",
        message: createMessage("assistant", reply),
      })
    } catch (err) {
      dispatch({
        type: "setError",
        error: err instanceof Error ? err.message : "Failed to get a response",
      })
    } finally {
      dispatch({ type: "generateEnd" })
    }
  }, [state.isGenerating])

  const submit = useCallback(() => {
    void sendMessage(state.input)
  }, [sendMessage, state.input])

  const stop = useCallback(() => {
    abortRef.current = true
    dispatch({ type: "generateEnd" })
  }, [])

  const clear = useCallback(() => {
    abortRef.current = true
    dispatch({ type: "clear" })
  }, [])

  return {
    messages: state.messages,
    input: state.input,
    isGenerating: state.isGenerating,
    error: state.error,
    setInput,
    sendMessage,
    submit,
    stop,
    clear,
  }
}

export type AiChatController = ReturnType<typeof useAiChat>
