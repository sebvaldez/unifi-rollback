import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react"
import {
  fetchDeviceSettings,
  persistDeviceSettings,
} from "@/lib/wails-client"
import type { DeviceSettings } from "@/types/settings"

type DeviceSettingsStatus = "idle" | "loading" | "ready" | "saving" | "error"

type DeviceSettingsState = {
  settings: DeviceSettings | null
  intervalDraft: string
  status: DeviceSettingsStatus
  error: string | null
}

type DeviceSettingsAction =
  | { type: "loadStart" }
  | { type: "loadSuccess"; settings: DeviceSettings }
  | { type: "loadError"; error: string }
  | { type: "saveStart" }
  | { type: "saveSuccess"; settings: DeviceSettings }
  | { type: "saveError"; error: string }
  | { type: "setIntervalDraft"; value: string }
  | { type: "reset" }

function deviceSettingsReducer(
  state: DeviceSettingsState,
  action: DeviceSettingsAction
): DeviceSettingsState {
  switch (action.type) {
    case "loadStart":
      return { ...state, status: "loading", error: null }
    case "loadSuccess":
      return {
        settings: action.settings,
        intervalDraft: String(action.settings.pollIntervalSeconds),
        status: "ready",
        error: null,
      }
    case "loadError":
      return {
        ...state,
        settings: null,
        status: "error",
        error: action.error,
      }
    case "saveStart":
      return { ...state, status: "saving", error: null }
    case "saveSuccess":
      return {
        settings: action.settings,
        intervalDraft: String(action.settings.pollIntervalSeconds),
        status: "ready",
        error: null,
      }
    case "saveError":
      return { ...state, status: "ready", error: action.error }
    case "setIntervalDraft":
      return { ...state, intervalDraft: action.value }
    case "reset":
      return {
        settings: null,
        intervalDraft: "60",
        status: "idle",
        error: null,
      }
    default:
      return state
  }
}

const initialState: DeviceSettingsState = {
  settings: null,
  intervalDraft: "60",
  status: "idle",
  error: null,
}

type DeviceSettingsContextValue = {
  settings: DeviceSettings | null
  intervalDraft: string
  loading: boolean
  saving: boolean
  ready: boolean
  error: string | null
  setIntervalDraft: (value: string) => void
  reload: () => Promise<void>
  save: (next: DeviceSettings) => Promise<void>
}

const DeviceSettingsContext = createContext<DeviceSettingsContextValue | null>(
  null
)

export function DeviceSettingsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(deviceSettingsReducer, initialState)

  const reload = useCallback(async () => {
    dispatch({ type: "loadStart" })
    try {
      const settings = await fetchDeviceSettings()
      dispatch({ type: "loadSuccess", settings })
    } catch (err) {
      dispatch({
        type: "loadError",
        error:
          err instanceof Error
            ? err.message
            : "Failed to load device settings",
      })
    }
  }, [])

  const save = useCallback(async (next: DeviceSettings) => {
    dispatch({ type: "saveStart" })
    try {
      await persistDeviceSettings(next)
      dispatch({ type: "saveSuccess", settings: next })
    } catch (err) {
      dispatch({
        type: "saveError",
        error:
          err instanceof Error
            ? err.message
            : "Failed to save device settings",
      })
      throw err
    }
  }, [])

  const setIntervalDraft = useCallback((value: string) => {
    dispatch({ type: "setIntervalDraft", value })
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<DeviceSettingsContextValue>(
    () => ({
      settings: state.settings,
      intervalDraft: state.intervalDraft,
      loading: state.status === "loading" || state.status === "idle",
      saving: state.status === "saving",
      ready: state.status === "ready" || state.status === "saving",
      error: state.error,
      setIntervalDraft,
      reload,
      save,
    }),
    [state, setIntervalDraft, reload, save]
  )

  return (
    <DeviceSettingsContext.Provider value={value}>
      {children}
    </DeviceSettingsContext.Provider>
  )
}

export function useDeviceSettings(): DeviceSettingsContextValue {
  const context = useContext(DeviceSettingsContext)
  if (!context) {
    throw new Error(
      "useDeviceSettings must be used within DeviceSettingsProvider"
    )
  }
  return context
}
