import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || "dev_secret";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });

  const token = authHeader.split(" ")[1];
  let decoded: any;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }

  const userId = decoded.id;

  // GET: TODO一覧（並び替えやフィルタリング対応）
  if (req.method === "GET") {
    const { sort } = req.query;
    let orderBy: any = { order: "asc" }; // ← デフォルトは order 順

    if (sort === "createdAt") {
      orderBy = { createdAt: "desc" };
    } else if (sort === "completed") {
      orderBy = { completed: "asc" };
    }

    const todos = await prisma.todo.findMany({
      where: { userId },
      orderBy,
    });
    return res.status(200).json(todos);
  }

  if (req.method === "POST") {
    const { title } = req.body;
    const todo = await prisma.todo.create({
      data: { title, userId },
    });
    return res.json(todo);
  }

  // PUT: TODO更新（完了チェック・進捗率・タイトル修正）
  if (req.method === "PUT") {
    try {
      const { id, completed, progress, title } = req.body; // ← progress を追加

      const updatedTodo = await prisma.todo.update({
        where: { id },
        data: {
          ...(completed !== undefined && { completed }),
          ...(progress !== undefined && { progress }), // ← ここで progress を更新
          ...(title && { title }),
          completedAt: completed ? new Date() : null,   // 完了したら日付も保存
        },
      });

      return res.status(200).json(updatedTodo);
    } catch (error) {
      console.error("Update error:", error);
      return res.status(500).json({ message: "Error updating todo" });
    }
  }

  if (req.method === "DELETE") {
    const { id } = req.body;
    await prisma.todo.delete({ where: { id } });
    return res.json({ message: "Deleted" });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
