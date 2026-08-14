import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react"
import { eligibleDevicesForAction } from "@/lib/device-bulk-actions"
import { locateDevice as locateDeviceRpc } from "@/lib/wails-client"
import type { Device, DeviceActionId } from "@/types/inventory"

type DeviceInventoryState = {
  devices: Device[]
  actionPending: Partial<Record<string, DeviceActionId>>
  actionError: string | null
}

type DeviceInventoryAction =
  | { type: "setDevices"; devices: Device[] }
  | { type: "actionStart"; deviceId: string; actionId: DeviceActionId }
  | { type: "actionDone"; deviceId: string }
  | { type: "actionError"; message: string }
  | { type: "clearActionError" }

function deviceInventoryReducer(
  state: DeviceInventoryState,
  action: DeviceInventoryAction
): DeviceInventoryState {
  switch (action.type) {
    case "setDevices":
      return { ...state, devices: action.devices }
    case "actionStart":
      return {
        ...state,
        actionPending: {
          ...state.actionPending,
          [action.deviceId]: action.actionId,
        },
        actionError: null,
      }
    case "actionDone": {
      const nextPending = { ...state.actionPending }
      delete nextPending[action.deviceId]
      return { ...state, actionPending: nextPending }
    }
    case "actionError":
      return { ...state, actionError: action.message, actionPending: {} }
    case "clearActionError":
      return { ...state, actionError: null }
    default:
      return state
  }
}

type DeviceInventoryContextValue = {
  devices: Device[]
  actionPending: Partial<Record<string, DeviceActionId>>
  actionError: string | null
  setDevices: (devices: Device[]) => void
  runDeviceAction: (
    device: Device,
    actionId: DeviceActionId
  ) => Promise<void>
  runBulkDeviceAction: (
    devices: Device[],
    actionId: DeviceActionId
  ) => Promise<boolean>
  bulkActionPending: boolean
  clearActionError: () => void
  isActionPending: (deviceId: string, actionId?: DeviceActionId) => boolean
}

const DeviceInventoryContext = createContext<DeviceInventoryContextValue | null>(
  null
)

export function DeviceInventoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(deviceInventoryReducer, {
    devices: [],
    actionPending: {},
    actionError: null,
  })
  const [bulkActionPending, setBulkActionPending] = useState(false)

  const setDevices = useCallback((devices: Device[]) => {
    dispatch({ type: "setDevices", devices })
  }, [])

  const clearActionError = useCallback(() => {
    dispatch({ type: "clearActionError" })
  }, [])

  const runDeviceAction = useCallback(
    async (device: Device, actionId: DeviceActionId) => {
      dispatch({ type: "actionStart", deviceId: device.id, actionId })
      try {
        switch (actionId) {
          case "locate":
            await locateDeviceRpc(device.siteId, device.id)
            break
          case "restart":
            throw new Error("Restart is not wired yet")
          case "rollback":
            throw new Error("Rollback flow is not available yet")
          default:
            throw new Error("Unknown action")
        }
      } catch (err) {
        dispatch({
          type: "actionError",
          message:
            err instanceof Error ? err.message : "Device action failed",
        })
        throw err
      } finally {
        dispatch({ type: "actionDone", deviceId: device.id })
      }
    },
    []
  )

  const runBulkDeviceAction = useCallback(
    async (devices: Device[], actionId: DeviceActionId): Promise<boolean> => {
      const eligible = eligibleDevicesForAction(devices, actionId)
      if (eligible.length === 0) return false

      setBulkActionPending(true)
      dispatch({ type: "clearActionError" })

      const errors: string[] = []
      try {
        for (const device of eligible) {
          dispatch({ type: "actionStart", deviceId: device.id, actionId })
          try {
            switch (actionId) {
              case "locate":
                await locateDeviceRpc(device.siteId, device.id)
                break
              case "restart":
                throw new Error("Restart is not wired yet")
              default:
                throw new Error("Bulk action not supported")
            }
          } catch (err) {
            errors.push(
              err instanceof Error
                ? `${device.name}: ${err.message}`
                : `${device.name}: action failed`
            )
          } finally {
            dispatch({ type: "actionDone", deviceId: device.id })
          }
        }

        if (errors.length > 0) {
          const succeeded = eligible.length - errors.length
          const summary =
            succeeded > 0
              ? `${succeeded} succeeded, ${errors.length} failed — ${errors[0]}`
              : errors[0]
          dispatch({ type: "actionError", message: summary })
          return false
        }

        return true
      } finally {
        setBulkActionPending(false)
      }
    },
    []
  )

  const isActionPending = useCallback(
    (deviceId: string, actionId?: DeviceActionId) => {
      const pending = state.actionPending[deviceId]
      if (!pending) return false
      return actionId ? pending === actionId : true
    },
    [state.actionPending]
  )

  const value = useMemo<DeviceInventoryContextValue>(
    () => ({
      devices: state.devices,
      actionPending: state.actionPending,
      actionError: state.actionError,
      setDevices,
      runDeviceAction,
      runBulkDeviceAction,
      bulkActionPending,
      clearActionError,
      isActionPending,
    }),
    [
      state.devices,
      state.actionPending,
      state.actionError,
      setDevices,
      runDeviceAction,
      runBulkDeviceAction,
      bulkActionPending,
      clearActionError,
      isActionPending,
    ]
  )

  return (
    <DeviceInventoryContext.Provider value={value}>
      {children}
    </DeviceInventoryContext.Provider>
  )
}

export function useDeviceInventory(): DeviceInventoryContextValue {
  const context = useContext(DeviceInventoryContext)
  if (!context) {
    throw new Error(
      "useDeviceInventory must be used within DeviceInventoryProvider"
    )
  }
  return context
}
