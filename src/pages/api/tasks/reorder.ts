// pages/api/tasks/reorder.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = getUserIdFromReq(req);
    if (req.method !== 'PUT') return res.status(405).json({ message: 'Method Not Allowed' });

    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n))) {
      return res.status(400).json({ message: 'Invalid ids' });
    }

    // ユーザーのタスクのみ対象にする（悪意あるID混入対策）
    const owned = await prisma.task.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((t) => t.id));
    const filtered = ids.filter((id: number) => ownedSet.has(id));

    // ギャップを持たせた order で更新（0,10,20,...）
    const ops = filtered.map((id: number, idx: number) =>
      prisma.task.update({
        where: { id },
        data: { order: idx * 10 },
        select: { id: true },
      })
    );

    await prisma.$transaction(ops);
    return res.status(200).json({ updated: filtered.length });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('reorder error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}