import { createAuthClient } from "better-auth/react";
import type { User } from "./types";

export const authClient = createAuthClient();

export async function fetchCurrentUser(): Promise<User | null> {
  const { data, error } = await authClient.getSession();
  if (error || !data?.user) return null;
  const user = data.user;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
  };
}
