import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import path from "path";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origin = req.header("origin");

    if (
      origin &&
      (origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.includes("onrender.com"))
    ) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;
      const duration = Date.now() - start;
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    });

    next();
  });
}

function setupErrorHandler(app: express.Application) {
  app.use(
    (err: unknown, _req: Request, res: Response, next: NextFunction) => {
      const error = err as {
        status?: number;
        statusCode?: number;
        message?: string;
      };

      const status = error.status || error.statusCode || 500;
      const message = error.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) return next(err);
      return res.status(status).json({ message });
    }
  );
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  await registerRoutes(app);

  // Servir build web do Expo (dist)
  app.use(express.static(path.resolve(process.cwd(), "dist")));

  app.get("*", (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), "dist", "index.html"));
  });

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);

  app.listen(port, "0.0.0.0", () => {
    log(`Server running on port ${port}`);
  });
})();
