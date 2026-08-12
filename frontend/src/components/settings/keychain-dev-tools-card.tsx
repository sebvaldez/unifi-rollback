import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTypedConfirm } from "@/hooks/use-typed-confirm"
import { KEYCHAIN_KNOWN_ACCOUNTS } from "@/lib/keychain-accounts"
import { formatWailsError } from "@/lib/wails-error"
import { RefreshCw, Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  DevKeychainDelete,
  DevKeychainList,
  DevKeychainSave,
  DevKeychainWipeAll,
  IsDevMode,
} from "../../../wailsjs/go/main/App"
import { main } from "../../../wailsjs/go/models"

type KeychainDevToolsCardProps = {
  className?: string
}

type RefreshOptions = {
  showProgress?: boolean
}

export function KeychainDevToolsCard({ className }: KeychainDevToolsCardProps) {
  const { requestConfirm, confirmDialog } = useTypedConfirm()
  const [devMode, setDevMode] = useState<boolean | null>(null)
  const [entries, setEntries] = useState<main.CredentialEntry[]>([])
  const [accountPreset, setAccountPreset] = useState<string>(
    KEYCHAIN_KNOWN_ACCOUNTS[0]
  )
  const [customAccount, setCustomAccount] = useState("")
  const [secret, setSecret] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refreshInFlightRef = useRef(false)

  const account =
    accountPreset === "custom" ? customAccount.trim() : accountPreset

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (refreshInFlightRef.current) {
      return
    }

    const showProgress = options?.showProgress ?? false
    refreshInFlightRef.current = true
    if (showProgress) {
      setRefreshing(true)
    }
    setError(null)

    try {
      const listed = await DevKeychainList()
      setEntries(listed ?? [])
    } catch (err) {
      setEntries([])
      setError(formatWailsError(err, "Failed to list Keychain entries"))
    } finally {
      refreshInFlightRef.current = false
      if (showProgress) {
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      try {
        const enabled = await IsDevMode()
        if (cancelled) return
        setDevMode(enabled)
        if (enabled) {
          await refresh()
        }
      } catch {
        if (!cancelled) setDevMode(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [refresh])

  if (loading || devMode === false) {
    return null
  }

  async function handleSave() {
    if (!account) {
      setError("Account name is required")
      return
    }
    if (!secret.trim()) {
      setError("Secret value is required")
      return
    }

    setBusy(true)
    setError(null)
    try {
      await DevKeychainSave(account, secret.trim())
      setSecret("")
      await refresh()
    } catch (err) {
      setError(formatWailsError(err, "Failed to save credential"))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(entryAccount: string) {
    const confirmed = await requestConfirm({
      title: `Delete "${entryAccount}"?`,
      description: (
        <>
          This removes the secret from the login keychain under service{" "}
          <code className="text-xs">com.wails.unifi-rollback</code>. This
          cannot be undone.
        </>
      ),
      confirmActionLabel: "Delete credential",
    })
    if (!confirmed) {
      return
    }

    setBusy(true)
    setError(null)
    try {
      await DevKeychainDelete(entryAccount)
      await refresh()
    } catch (err) {
      setError(formatWailsError(err, "Failed to delete credential"))
    } finally {
      setBusy(false)
    }
  }

  async function handleWipeAll() {
    const count = entries.length
    const confirmed = await requestConfirm({
      title: "Wipe all Keychain credentials?",
      description: (
        <>
          {count > 0 ? (
            <>
              {count} credential{count === 1 ? "" : "s"} in this list will be
              removed from the login keychain.
            </>
          ) : (
            <>Any credentials stored for this app namespace will be removed.</>
          )}{" "}
          Service namespace:{" "}
          <code className="text-xs">com.wails.unifi-rollback</code>.
        </>
      ),
      confirmActionLabel: "Wipe all credentials",
    })
    if (!confirmed) {
      return
    }

    setBusy(true)
    setError(null)
    try {
      await DevKeychainWipeAll()
      setSecret("")
      await refresh()
    } catch (err) {
      setError(formatWailsError(err, "Failed to wipe Keychain credentials"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card
        className={cn(
          "border-dashed border-[color-mix(in_srgb,var(--unifi-blue)_35%,var(--unifi-border))] shadow-sm",
          className
        )}
      >
        <CardHeader>
          <CardTitle className="text-base">Keychain dev tools</CardTitle>
          <CardDescription>
            Development builds only. Add test credentials, verify round-trip
            storage, and wipe the app namespace clean. If list/wipe fail after a
            rebuild, delete the item manually in Keychain Access (login keychain)
            or restart <code className="text-xs">wails dev</code> and try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="keychain-account-preset"
                className="text-sm font-medium text-[var(--unifi-text)]"
              >
                Account
              </label>
              <select
                id="keychain-account-preset"
                value={accountPreset}
                onChange={(event) => setAccountPreset(event.target.value)}
                className="h-9 w-full rounded-md border border-[var(--unifi-border)] bg-[var(--unifi-surface)] px-3 text-sm text-[var(--unifi-text)]"
                disabled={busy}
              >
                {KEYCHAIN_KNOWN_ACCOUNTS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
                <option value="custom">Custom account…</option>
              </select>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="keychain-secret"
                className="text-sm font-medium text-[var(--unifi-text)]"
              >
                Secret value
              </label>
              <Input
                id="keychain-secret"
                type="password"
                placeholder="Test API key or passphrase"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          {accountPreset === "custom" ? (
            <div className="space-y-2">
              <label
                htmlFor="keychain-custom-account"
                className="text-sm font-medium text-[var(--unifi-text)]"
              >
                Custom account name
              </label>
              <Input
                id="keychain-custom-account"
                placeholder="e.g. network-local-api-key:lab"
                value={customAccount}
                onChange={(event) => setCustomAccount(event.target.value)}
                disabled={busy}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleSave()} disabled={busy || refreshing}>
              Save to Keychain
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void refresh({ showProgress: true })}
              disabled={busy || refreshing}
            >
              <RefreshCw
                className={cn("size-4", refreshing && "animate-spin")}
              />
              {refreshing ? "Refreshing…" : "Refresh list"}
            </Button>
            <Button
              variant="outline"
              className="text-[var(--destructive)]"
              onClick={() => void handleWipeAll()}
              disabled={busy || refreshing}
            >
              Wipe all credentials
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          ) : null}

          <div
            className={cn(
              "rounded-md",
              refreshing && "inventory-card-refreshing"
            )}
          >
            {entries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Account</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.account}>
                      <TableCell className="font-mono text-xs">
                        {entry.account}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${entry.account}`}
                          onClick={() => void handleDelete(entry.account)}
                          disabled={busy || refreshing}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-[var(--unifi-text-muted)]">
                {refreshing ? (
                  "Loading credentials from Keychain…"
                ) : (
                  <>
                    No credentials stored for service namespace{" "}
                    <code className="text-xs">com.wails.unifi-rollback</code>.
                  </>
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      {confirmDialog}
    </>
  )
}
