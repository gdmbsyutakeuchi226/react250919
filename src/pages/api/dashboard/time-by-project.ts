// pages/api/dashboard/time-by-project.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const userId = await getUserIdFromReq(req);
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    // プロジェクト別に作業時間を集計
    const results = await prisma.project.findMany({
      where: {
        tasks: {
          some: {
            userId,
            timeEntries: {
              some: {
                startTime: { gte: new Date(startDate), lte: new Date(endDate) },
              },
            },
          },
        },
      },
      select: {
        name: true,
        tasks: {
          where: {
            userId,
            timeEntries: {
              some: {
                startTime: { gte: new Date(startDate), lte: new Date(endDate) },
              },
            },
          },
          select: {
            timeEntries: {
              where: {
                startTime: { gte: new Date(startDate), lte: new Date(endDate) },
              },
              select: { durationMinutes: true },
            },
          },
        },
      },
    });

    // 集計処理
    const projects = results.map(project => {
      const totalMinutes = project.tasks.reduce((sum, task) => {
        return sum + task.timeEntries.reduce((s, te) => s + (te.durationMinutes ?? 0), 0);
      }, 0);
      return { project: project.name, minutes: totalMinutes };
    }).sort((a, b) => b.minutes - a.minutes);

    return res.status(200).json({ projects });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('time-by-project error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}