import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

const MAX_MINUTES_PER_DAY = 8 * 60; // 1日あたりの最大記録時間（分）

/**
 * 開始日時と終了日時を日ごとに分割し、1日あたりの上限時間を適用して返す
 * 休憩時間を考慮した時間計算を行う
 */
function splitIntoDailyEntries(start: Date, end: Date, breakMinutes: number = 0) {
  const entries: { startTime: Date; durationMinutes: number }[] = [];
  let current = new Date(start);

  while (current < end) {
    // 当日の終了時刻（23:59:59.999）
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    // この日の終了時刻は、全体の終了時刻か日末の早い方
    const segmentEnd = end < dayEnd ? end : dayEnd;

    // 分数計算（休憩時間を差し引く）
    let minutes = Math.round((segmentEnd.getTime() - current.getTime()) / 60000);
    minutes = Math.max(0, minutes - breakMinutes);

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
    const { taskId, startTime, endTime, breakMinutes = 0 } = req.body;

    if (!taskId || !startTime || !endTime) {
      return res.status(400).json({ message: 'taskId, startTime, endTime are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: 'Invalid start/end time' });
    }

    // 休憩時間の検証
    const breakMins = Number(breakMinutes) || 0;
    if (breakMins < 0) {
      return res.status(400).json({ message: 'Break minutes must be non-negative' });
    }

    // タスクがユーザーのものであることを確認
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // 同じタスクの同じ日付の既存エントリを削除（上書き処理）
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(start);
    endDate.setHours(23, 59, 59, 999);

    await prisma.timeEntry.deleteMany({
      where: {
        taskId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // 日単位に分割して保存（休憩時間を考慮）
    const segments = splitIntoDailyEntries(start, end, breakMins);
    for (const seg of segments) {
      await prisma.timeEntry.create({
        data: {
          taskId,
          startTime: seg.startTime,
          endTime: end, // 終了時刻を保存
          durationMinutes: seg.durationMinutes,
          breakMinutes: breakMins, // 休憩時間を保存
        },
      });
    }

    return res.status(200).json({
      message: `Time entry recorded (${segments.length} segment${segments.length > 1 ? 's' : ''})`,
      breakMinutes: breakMins,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}