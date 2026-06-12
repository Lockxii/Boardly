import { createRouter, createRootRouteWithContext, createRoute, redirect, Outlet } from "@tanstack/react-router";
import { QueryClient, useQuery, queryOptions } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { fetchCurrentUser } from "./lib/auth-client";
import type { User } from "./lib/types";

// Auth hook
export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// Auth query options for beforeLoad
const authQueryOptions = () =>
  queryOptions<User | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
  });

// Loading fallback
function RouteLoading() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-neutral-500">Chargement...</span>
      </div>
    </div>
  );
}

// Root route
const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
});

// Index / Landing — eager (first page users see)
import { LandingPage } from "./components/landing-page";

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

// Auth — eager (small page)
import { SignInPage } from "./routes/auth-sign-in";

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
});

const signInRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/sign-in",
  component: SignInPage,
});

// Dashboard — lazy loaded
const LazyDashboard = lazy(() => import("./routes/dashboard").then((m) => ({ default: m.DashboardPage })));

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: async ({ context }) => {
    try {
      const user = await context.queryClient.ensureQueryData(authQueryOptions());
      if (!user) throw redirect({ to: "/auth/sign-in" });
    } catch {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <LazyDashboard />
    </Suspense>
  ),
});

// Board — lazy loaded (heaviest route)
const LazyBoard = lazy(() => import("./routes/board").then((m) => ({ default: m.BoardPage })));

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board/$boardId",
  beforeLoad: async ({ context }) => {
    try {
      const user = await context.queryClient.ensureQueryData(authQueryOptions());
      if (!user) throw redirect({ to: "/auth/sign-in" });
    } catch {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: () => (
    <Suspense fallback={<RouteLoading />}>
      <LazyBoard />
    </Suspense>
  ),
});

// 404
import { NotFoundPage } from "./routes/not-found";

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$",
  component: NotFoundPage,
});

// Build tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute.addChildren([signInRoute]),
  dashboardRoute,
  boardRoute,
  notFoundRoute,
]);

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined! },
  defaultPreload: "intent",
  scrollRestoration: true,
});
