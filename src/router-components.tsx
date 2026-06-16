import { Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { RouteLoading } from "./components/route-loading";

const LazyDashboard = lazy(() => import("./routes/dashboard").then((m) => ({ default: m.DashboardPage })));
const LazyBoard = lazy(() => import("./routes/board").then((m) => ({ default: m.BoardPage })));
const LazyShare = lazy(() => import("./routes/share").then((m) => ({ default: m.SharePage })));

export function RootRouteComponent() {
  return <Outlet />;
}

export function DashboardRouteComponent() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <LazyDashboard />
    </Suspense>
  );
}

export function BoardRouteComponent() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <LazyBoard />
    </Suspense>
  );
}

export function ShareRouteComponent() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <LazyShare />
    </Suspense>
  );
}
