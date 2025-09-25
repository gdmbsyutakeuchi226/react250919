import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

const MAX_MINUTES_PER_DAY = 8 * 60; // 1日あたりの最大記録時間（分）

/**
 * 開始日時と終了日時を日ごとに分割し、1日あたりの上限時間を適用して返す
 */
function splitIntoDailyEntries(start: Date, end: Date) {
  const entries: { startTime: Date; durationMinutes: number }[] = [];
  let current = new Date(start);

  while (current < end) {
    // 当日の終了時刻（23:59:59.999）
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    // この日の終了時刻は、全体の終了時刻か日末の早い方
    const segmentEnd = end < dayEnd ? end : dayEnd;

    // 分数計算
    let minutes = Math.round((segmentEnd.getTime() - current.getTime()) / 60000);

    // 上限適用（最低1分は記録）
    minutes = Math.max(1, Math.min(minutes, MAX_MINUTES_PER_DAY));

    entries.push({
      startTime: new Date(current),
      durationMinutes: minutes,
    });

    // 次の日の0:00に進める
    current = new Date(dayEnd.getTime() + 1);
  }

  return entries;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const userId = await getUserIdFromReq(req);
    const { taskId, startTime, endTime } = req.body;

    if (!taskId || !startTime || !endTime) {
      return res.status(400).json({ message: 'taskId, startTime, endTime are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: 'Invalid start/end time' });
    }

    // タスクがユーザーのものであることを確認
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // 日単位に分割して保存
    const segments = splitIntoDailyEntries(start, end);
    for (const seg of segments) {
      await prisma.timeEntry.create({
        data: {
          taskId,
          startTime: seg.startTime,
          durationMinutes: seg.durationMinutes,
        },
      });
    }

    return res.status(200).json({
      message: `Time entry recorded (${segments.length} segment${segments.length > 1 ? 's' : ''})`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}