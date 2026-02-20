import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { originCheck } from "./middleware/originCheck";
import { sessionMiddleware } from "./middleware/session";
import { subscriptionMiddleware } from "./middleware/subscription";
import authRoutes from "./routes/auth";
import healthRoutes from "./routes/health";
import debugRoutes from "./routes/debug";
import inventoryRoutes from "./routes/inventory";
import dealersRoutes from "./routes/dealers";
import assignmentsRoutes from "./routes/assignments";
import consignmentsRoutes from "./routes/consignments";
import shopRoutes from "./routes/shop";
import subscriptionRoutes from "./routes/subscription";
import adminRoutes from "./routes/admin";
import notificationsRoutes from "./routes/notifications";
import exportRoutes from "./routes/export";
import dashboardRoutes from "./routes/dashboard";
import reportsRoutes from "./routes/reports";
import { fail } from "./lib/http";

export function createServer() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(morgan("combined"));

  app.use(
    cors({
      origin: process.env.WEB_ORIGIN,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(originCheck);

  // Global rate limit (soft)
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(sessionMiddleware);
  app.use(subscriptionMiddleware);

  app.use("/api", healthRoutes);
  app.use("/api", debugRoutes);
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    authRoutes,
  );
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/dealers", dealersRoutes);
  app.use("/api/consignments", consignmentsRoutes);
  app.use("/api/assignments", assignmentsRoutes);
  app.use("/api/shop", shopRoutes);
  app.use("/api/subscription", subscriptionRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/export", exportRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reports", reportsRoutes);

  app.use((_req, res) => fail(res, 404, "NOT_FOUND", "Not found."));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    return fail(res, 500, "INTERNAL_ERROR", "Internal server error.");
  });

  return app;
}


