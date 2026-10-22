import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Loader2 } from "lucide-react"

import { Button } from "./button"
import { Tooltip } from "./tooltip"

type IconButtonProps = Omit<React.ComponentProps<typeof Button>, "children"> & {
  /** Accessible name, also shown as tooltip. */
  label: string
  icon: LucideIcon
  shortcut?: string
  busy?: boolean
}

/** Icon-only button that always carries an aria-label and a tooltip. */
function IconButton({
  label,
  icon: Icon,
  shortcut,
  busy,
  variant = "ghost",
  size = "icon-sm",
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <Button
        variant={variant}
        size={size}
        aria-label={label}
        disabled={disabled || busy}
        {...props}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Icon />}
      </Button>
    </Tooltip>
  )
}

export { IconButton }
