import express from "express";
import { ok } from "../lib/http";

const router = express.Router();

router.get("/health", async (_req, res) => {
  return ok(res, { status: "ok" });
});

export default router;


