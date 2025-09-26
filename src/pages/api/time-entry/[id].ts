// pages/api/time-entry/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromReq(req);
    const { id } = req.query as { id: string };

    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({ message: 'Invalid time entry ID' });
    }

    const timeEntryId = parseInt(id, 10);

    if (req.method === 'GET') {
      // 時間記録の詳細を取得
      const timeEntry = await prisma.timeEntry.findFirst({
        where: {
          id: timeEntryId,
          task: { userId },
        },
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
      });

      if (!timeEntry) {
        return res.status(404).json({ message: 'Time entry not found' });
      }

      return res.status(200).json(timeEntry);
    }

    if (req.method === 'PUT') {
      // 時間記録を更新
      const { startTime, endTime, breakMinutes } = req.body;

      if (!startTime || !endTime) {
        return res.status(400).json({ message: 'startTime and endTime are required' });
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }

      if (start >= end) {
        return res.status(400).json({ message: 'startTime must be before endTime' });
      }

      const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60)) - (breakMinutes || 0));

      const updatedTimeEntry = await prisma.timeEntry.updateMany({
        where: {
          id: timeEntryId,
          task: { userId },
        },
        data: {
          startTime: start,
          endTime: end,
          durationMinutes,
          breakMinutes: breakMinutes || 0,
        },
      });

      if (updatedTimeEntry.count === 0) {
        return res.status(404).json({ message: 'Time entry not found' });
      }

      return res.status(200).json({ message: 'Time entry updated successfully' });
    }

    if (req.method === 'DELETE') {
      // 時間記録を削除
      const deletedTimeEntry = await prisma.timeEntry.deleteMany({
        where: {
          id: timeEntryId,
          task: { userId },
        },
      });

      if (deletedTimeEntry.count === 0) {
        return res.status(404).json({ message: 'Time entry not found' });
      }

      return res.status(200).json({ message: 'Time entry deleted successfully' });
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('time-entry [id] error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
