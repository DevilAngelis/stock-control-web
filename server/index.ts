import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import path from "path";

const app = express();
const log = console.log;

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  setupCors(app);

  // Registrar rotas da API antes de servir arquivos estáticos
  await registerRoutes(app);

  // Servir build web do Expo (dist)
  const distPath = path.resolve(process.cwd(), "dist");
  app.use(express.static(distPath));

  // Rota catch-all para o frontend (SPA)
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  app.listen(port, "0.0.0.0", () => {
    log(`Server running on port ${port}`);
  });
})();
