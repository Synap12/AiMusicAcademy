---
name: Preview routing
description: Artifact preview routing must expose the frontend at the root path when the API server also serves the built web app.
---

The main preview must route to the frontend-serving service at `/`; API endpoints can remain under `/api`. A service registered only at `/api` makes the root preview show the Replit unreachable screen, while `/api/` may hit the backend fallback instead of the frontend.

**Why:** The canvas and workspace Preview entry points resolve the artifact's registered preview path, not an arbitrary internal service route.

**How to apply:** When one Express server serves both the built React app and API routes, keep the artifact preview path at `/`, include `/api` as an additional service path if needed, and verify both `/` and `/api/healthz` after restarting the managed workflow.