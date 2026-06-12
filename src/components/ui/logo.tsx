import { cn } from "@/lib/utils";

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("rounded-lg", className)}
    >
      <rect width="32" height="32" rx="6" fill="#2563EB" />
      <path
        d="M8 16C8 14.3431 9.34315 13 11 13H21C22.6569 13 24 14.3431 24 16V22C24 23.6569 22.6569 25 21 25H11C9.34315 25 8 23.6569 8 22V16Z"
        fill="white"
        opacity="0.9"
      />
      <circle cx="12" cy="10" r="3" fill="white" opacity="0.6" />
      <circle cx="20" cy="10" r="3" fill="white" opacity="0.4" />
      <rect x="11" y="17" width="4" height="2" rx="1" fill="#2563EB" opacity="0.8" />
      <rect x="17" y="17" width="4" height="2" rx="1" fill="#2563EB" opacity="0.5" />
      <rect x="11" y="21" width="10" height="1" rx="0.5" fill="#2563EB" opacity="0.3" />
    </svg>
  );
}
