// pages/api/dashboard/top-task.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const userId = getUserIdFromReq(req);
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const results = await prisma.task.findMany({
      where: {
        userId,
        timeEntries: {
          some: {
            startTime: { gte: new Date(startDate), lte: new Date(endDate) },
          },
        },
      },
      select: {
        title: true,
        timeEntries: {
          where: {
            startTime: { gte: new Date(startDate), lte: new Date(endDate) },
          },
          select: { durationMinutes: true },
        },
      },
    });

    let topTask = null;
    let maxMinutes = 0;

    for (const task of results) {
      const totalMinutes = task.timeEntries.reduce(
        (sum, te) => sum + (te.durationMinutes ?? 0),
        0
      );
      if (totalMinutes > maxMinutes) {
        maxMinutes = totalMinutes;
        topTask = task.title;
      }
    }

    return res.status(200).json({ task: topTask, minutes: maxMinutes });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('top-task error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}