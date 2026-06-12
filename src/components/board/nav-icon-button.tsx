import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavIconButtonProps = React.ComponentProps<typeof Button> & {
  active?: boolean;
};

export const NavIconButton = forwardRef<HTMLButtonElement, NavIconButtonProps>(
  ({ className, active, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn(
        "h-9 w-9 text-neutral-600 dark:text-neutral-400",
        "transition-colors duration-150 ease-out",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        "active:bg-neutral-200/90 dark:active:bg-neutral-700/90",
        active && "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
);
NavIconButton.displayName = "NavIconButton";
