import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || "my_super_secret_key";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });

  try {
    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, SECRET);

    const admin = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { id, role } = req.body;
    await prisma.user.update({
      where: { id },
      data: { role },
    });

    return res.json({ message: "Role updated" });
  } catch (err: any) {
    return res.status(500).json({ message: "Error", error: err.message });
  }
}
