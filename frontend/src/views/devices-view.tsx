import { Badge } from "@/components/ui/badge"
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
import { cn } from "@/lib/utils"
import { placeholderDevices } from "@/lib/placeholders"

type DevicesViewProps = {
  isRefreshing: boolean
}

export function DevicesView({ isRefreshing }: DevicesViewProps) {
  return (
    <Card
      className={cn(
        "border-[var(--unifi-border)] shadow-sm transition-opacity duration-300",
        isRefreshing && "inventory-card-refreshing opacity-95"
      )}
    >
      <CardHeader className="border-b border-[var(--unifi-border)] pb-4">
        <CardTitle className="text-base">Device inventory</CardTitle>
        <CardDescription>
          Fleet-wide view across Site Manager sites. Connect API keys in
          Settings to load live data.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Firmware</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {placeholderDevices.map((device) => (
              <TableRow key={device.name}>
                <TableCell className="font-medium">{device.name}</TableCell>
                <TableCell>{device.model}</TableCell>
                <TableCell>{device.firmware}</TableCell>
                <TableCell>{device.site}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      device.status === "Online"
                        ? "border-[color-mix(in_srgb,var(--unifi-success)_35%,var(--unifi-surface))] bg-[color-mix(in_srgb,var(--unifi-success)_12%,var(--unifi-surface))] text-[var(--unifi-success)]"
                        : "border-[var(--unifi-border)] text-[var(--unifi-text-muted)]"
                    }
                  >
                    {device.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
