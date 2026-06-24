import { Router, type Request, type Response } from "express";
import { authenticate, getDemoCredentials } from "../mockData.js";

const router = Router();

router.get("/demo-credentials", (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: getDemoCredentials(),
  });
});

router.post("/register", async (_req: Request, res: Response): Promise<void> => {
  res.status(501).json({
    success: false,
    error: "首版不开放自注册，请使用预置账号登录。",
  });
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body ?? {};
  const result = authenticate(username, password);

  if (!result) {
    res.status(401).json({
      success: false,
      error: "账号或密码错误。",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: result,
  });
});

router.post("/logout", async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message: "已退出当前会话。",
  });
});

export default router;
