// src/pages/api/admin/users.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || "my_super_secret_key";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = jwt.verify(token, SECRET);

    // 管理者チェック
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admin only" });
    }

    // 全ユーザーを返す
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true }
    });

    return res.json(users);
  } catch (err: any) {
    return res.status(401).json({ message: "Invalid token", error: err.message });
  }
}
