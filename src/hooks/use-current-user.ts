import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUser } from "@/lib/auth-client";
import type { User } from "@/lib/types";

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
