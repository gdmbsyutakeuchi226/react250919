// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import redis from "../../lib/redis";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Missing field" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    // セッションIDを生成
    const sessionId = randomUUID();

    // Redisに保存 (有効期限1時間)
    await redis.set(`session:${sessionId}`, JSON.stringify({ id: user.id, email: user.email }), "EX", 3600);

    // クライアントに返す
    return res.status(200).json({ message: "Login successful", sessionId });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Error logging in", error: error.message });
  }
}