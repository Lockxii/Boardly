import { cn } from "@/lib/utils";
import fredAiIcon from "@/assets/fred-ai.png";

export const FRED_AI_ICON = fredAiIcon;

type FredAvatarProps = {
  className?: string;
  size?: number;
};

export function FredAvatar({ className, size = 36 }: FredAvatarProps) {
  return (
    <img
      src={fredAiIcon}
      alt="Fred AI"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      draggable={false}
    />
  );
}

export function FredIcon({ className, size = 22 }: FredAvatarProps) {
  return (
    <img
      src={fredAiIcon}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      draggable={false}
    />
  );
}
