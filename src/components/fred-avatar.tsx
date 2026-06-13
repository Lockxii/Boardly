import { cn } from "@/lib/utils";

export const FRED_AI_ICON = "/fred-ai.png";

type FredAvatarProps = {
  className?: string;
  size?: number;
};

export function FredAvatar({ className, size = 32 }: FredAvatarProps) {
  return (
    <img
      src={FRED_AI_ICON}
      alt="Fred AI"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-xl object-cover shadow-sm", className)}
      draggable={false}
    />
  );
}

export function FredIcon({ className, size = 20 }: FredAvatarProps) {
  return (
    <img
      src={FRED_AI_ICON}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0 rounded-md object-cover", className)}
      draggable={false}
    />
  );
}
