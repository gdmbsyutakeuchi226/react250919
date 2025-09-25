// pages/api/dashboard/completed-tasks.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

    const userId = await getUserIdFromReq(req);
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const count = await prisma.task.count({
      where: {
        userId,
        completed: true,
        completedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    return res.status(200).json({ completedTasks: count });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('completed-tasks error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}