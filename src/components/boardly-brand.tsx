import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type BoardlyBrandProps = {
  size?: number;
  showName?: boolean;
  className?: string;
  nameClassName?: string;
  to?: string;
  onClick?: () => void;
};

export function BoardlyBrand({
  size = 32,
  showName = true,
  className,
  nameClassName,
  to,
  onClick,
}: BoardlyBrandProps) {
  const content = (
    <>
      <Logo size={size} className="shrink-0" />
      {showName && (
        <span className={cn("font-bold tracking-tight", nameClassName)}>Boardly</span>
      )}
    </>
  );

  const classes = cn("inline-flex items-center gap-2.5", className);

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
