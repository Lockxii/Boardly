import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    // In production, this should use process.env.BETTER_AUTH_URL
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000" 
})
