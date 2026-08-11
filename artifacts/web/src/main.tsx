import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { PlayerProvider } from "./lib/player";
import { ToastProvider } from "./lib/toast";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// Offline support: the service worker caches the app shell so downloaded
// music in My Library stays playable without a connection.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
  // When a new service worker takes control (a fresh deploy), reload once so
  // the page runs the latest app instead of a stale cached shell.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlayerProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </PlayerProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
