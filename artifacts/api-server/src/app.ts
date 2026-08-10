import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import webhooksRouter from "./routes/webhooks";
import { attachUser } from "./middlewares/auth";
import { UPLOADS_ROOT } from "./lib/uploads";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Stripe webhook needs the raw body for signature verification, so it is
// mounted before the JSON body parser.
app.use("/api", webhooksRouter);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);

app.use("/uploads", express.static(UPLOADS_ROOT, { maxAge: "7d" }));

app.use("/api", router);

// Serve the built frontend (production). In dev, Vite serves it with a proxy.
const webDistCandidates = [
  process.env.WEB_DIST,
  path.resolve(process.cwd(), "artifacts/web/dist"),
  path.resolve(__dirname, "../../web/dist"),
].filter((p): p is string => !!p);
const webDist = webDistCandidates.find((p) =>
  fs.existsSync(path.join(p, "index.html")),
);
if (webDist) {
  app.use(express.static(webDist, { maxAge: "1h", index: false }));
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
  logger.info({ webDist }, "Serving frontend");
} else {
  logger.warn("Frontend build not found; API-only mode");
}

// Central error handler — multer/zod/route errors land here.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled request error");
  if (res.headersSent) return;
  const message =
    err.name === "MulterError" || err.message.includes("must be")
      ? err.message
      : "Something went wrong. Please try again.";
  res.status(err.name === "MulterError" ? 400 : 500).json({ error: message });
});

export default app;
