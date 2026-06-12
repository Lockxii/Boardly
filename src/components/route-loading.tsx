import { Logo } from "@/components/ui/logo";

export function RouteLoading({ label = "Chargement..." }: { label?: string }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FDFCF8] dark:bg-[#0A0A0A]">
      <div className="flex flex-col items-center gap-4">
        <Logo size={40} className="animate-pulse" />
        <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-neutral-500">{label}</span>
      </div>
    </div>
  );
}
