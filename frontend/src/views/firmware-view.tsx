import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function FirmwareView() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Verified manifest</CardTitle>
          <CardDescription>
            Pinned firmware builds with SHA256 verification before rollback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--unifi-text-muted)]">
            No manifest entries yet. Add a mirror URL from a community release
            thread to get started.
          </p>
          <Button className="mt-4">Add firmware entry</Button>
        </CardContent>
      </Card>

      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Validation gate</CardTitle>
          <CardDescription>
            Domain allowlist, download, and checksum before any push.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--unifi-text-muted)]">
          <p>Allowed: dl.ui.com, fw-download.ubnt.com</p>
          <p>Verified badge renders only on SHA256 match.</p>
        </CardContent>
      </Card>
    </div>
  )
}
