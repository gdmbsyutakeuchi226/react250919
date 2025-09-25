// pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import redis from "../../lib/redis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const header = req.headers.authorization || "";
  const sessionId = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!sessionId) {
    return res.status(400).json({ message: "No sessionId provided" });
  }

  await redis.del(`session:${sessionId}`);
  return res.status(200).json({ message: "Logged out successfully" });
}