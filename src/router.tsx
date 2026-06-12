import { createRouter, createRootRouteWithContext, createRoute, redirect, Outlet } from "@tanstack/react-router";
import { QueryClient, useQuery, queryOptions } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { fetchCurrentUser } from "./lib/auth-client";
import type { User } from "./lib/types";
import { RouteLoading } from "./components/route-loading";

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
