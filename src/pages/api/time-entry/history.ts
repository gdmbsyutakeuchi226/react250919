// pages/api/time-entry/history.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const userId = await getUserIdFromReq(req);
    const { startDate, endDate, page = '1', limit = '20' } = req.query as {
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // 期間フィルタの設定
    const whereClause: any = {
      task: { userId },
    };

    if (startDate && endDate) {
      whereClause.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // 時間記録の履歴を取得
    const [timeEntries, totalCount] = await Promise.all([
      prisma.timeEntry.findMany({
        where: whereClause,
        include: {
          task: {
            select: {
              id: true,
              title: true,
              tags: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          startTime: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.timeEntry.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      timeEntries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
      },
    });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('time-entry history error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
