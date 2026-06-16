import { createRouter, createRootRouteWithContext, createRoute, redirect } from "@tanstack/react-router";
import { QueryClient, queryOptions } from "@tanstack/react-query";
import { fetchCurrentUser } from "./lib/auth-client";
import type { User } from "./lib/types";
import {
  BoardRouteComponent,
  DashboardRouteComponent,
  RootRouteComponent,
  ShareRouteComponent,
} from "./router-components";

// Auth query options for beforeLoad
const authQueryOptions = () =>
  queryOptions<User | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
  });

// Root route
const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootRouteComponent,
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

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(authQueryOptions()).catch(() => null);
    if (!user) throw redirect({ to: "/auth/sign-in", search: { redirect: location.href } });
  },
  component: DashboardRouteComponent,
});

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board/$boardId",
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(authQueryOptions()).catch(() => null);
    if (!user) throw redirect({ to: "/auth/sign-in", search: { redirect: location.href } });
  },
  component: BoardRouteComponent,
});

const shareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/share/$boardId",
  component: ShareRouteComponent,
});

import { PrivacyPage, TermsPage } from "./routes/legal";

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: TermsPage,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage,
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
  shareRoute,
  termsRoute,
  privacyRoute,
  notFoundRoute,
]);

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined! },
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
