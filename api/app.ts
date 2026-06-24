import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import authRoutes from "./routes/auth.js";
import modelCropRoutes from "./routes/modelCrop.js";
import platformRoutes from "./routes/platform.js";

dotenv.config();

const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/model-crop", modelCropRoutes);
app.use("/api/platform", platformRoutes);

app.use("/api/health", (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: "ok",
  });
});

const distDir = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use("/api/*", (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "API not found",
  });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: error.message || "Server internal error",
  });
});

export default app;
