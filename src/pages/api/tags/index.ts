// pages/api/tags/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromReq(req);
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

    // ユーザーのタスクに紐づくタグを収集
    const tasks = await prisma.task.findMany({
      where: { userId },
      select: { tags: { select: { id: true, name: true } } },
    });

    const map = new Map<string, number>();
    for (const t of tasks) {
      for (const tag of t.tags) {
        if (!map.has(tag.name)) map.set(tag.name, tag.id);
      }
    }

    const tags = Array.from(map.entries())
      .map(([name, id]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    // ダッシュボード側は配列/オブジェクトどちらも対応しているが、明示で { tags: [...] } を返す
    return res.status(200).json({ tags });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('tags list error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}