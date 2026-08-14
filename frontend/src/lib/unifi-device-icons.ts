/**
 * Device icon resolution.
 *
 * Official UniFi icon sources (for future bundling or proxying):
 * - design.ui.com rack/desktop PNGs, e.g.
 *   https://design.ui.com/uploads/products/rack/UDM-PRO.png
 * - Controller UI assets:
 *   …/react/images/device/{type}/{model}/grid@2x.png
 * - Client fingerprint CDN:
 *   https://static.ui.com/fingerprint/{engine}/{devId}_257x257.png
 *
 * We ship lightweight local SVGs in /public/devices for dev reliability.
 */
const ICON_BY_MODEL: Record<string, string> = {
  "U7-Pro-XGS": "/devices/u7-pro-xgs.svg",
  U7PROXGS: "/devices/u7-pro-xgs.svg",
  "USW-Flex-2.5G-8": "/devices/usw-flex-2.5g-8.svg",
  USWFLEX2G8: "/devices/usw-flex-2.5g-8.svg",
  "UDM-Pro-SE": "/devices/udm-pro-se.svg",
  UDMPROSE: "/devices/udm-pro-se.svg",
}

export function resolveDeviceIconUrl(
  model: string,
  explicit?: string
): string | undefined {
  if (explicit) return explicit
  return ICON_BY_MODEL[model] ?? ICON_BY_MODEL[model.replace(/\s+/g, "")]
}
