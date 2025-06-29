import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { queryClient } from "@/lib/query-client";
import { googleAuth } from "@/lib/google-auth";
import { ErrorBoundary, ErrorToast } from "@/lib/errors";

export const Route = createRootRoute({
  component: () => (
    <ErrorBoundary context="root">
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={googleAuth.getClientId()}>
          <div className="w-full h-svh">
            <Outlet />
          </div>
          <ErrorToast position="bottom-left" maxVisible={2} autoHideDuration={4000} />
          <ReactQueryDevtools initialIsOpen={false} />
          <TanStackRouterDevtools />
        </GoogleOAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  ),
});
