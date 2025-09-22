// pages/api/dashboard/summary.ts
// pages/api/dashboard/summary.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

// リトライ方針: 開発は無限、通常は最大回数+指数バックオフ
const INFINITE_RETRY = process.env.SERVER_INFINITE_RETRY === 'true';
const MAX_RETRIES = Number(process.env.SERVER_MAX_RETRIES ?? 8);
const BASE_DELAY_MS = Number(process.env.SERVER_RETRY_BASE_DELAY_MS ?? 500);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  if (INFINITE_RETRY) {
    // 無限制裁モード（開発用）
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await fn();
      } catch (err) {
        console.error('[summary] retry (infinite):', err);
        await sleep(BASE_DELAY_MS);
      }
    }
  } else {
    // 通常モード: 最大回数 + 指数バックオフ
    let attempt = 0;
    let delay = BASE_DELAY_MS;
    // 少なくとも1回は実行
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        if (attempt > MAX_RETRIES) {
          console.error(`[summary] retries exhausted (${MAX_RETRIES})`, err);
          throw err;
        }
        console.warn(`[summary] retry attempt ${attempt}/${MAX_RETRIES} in ${delay}ms`);
        await sleep(delay);
        delay = Math.min(delay * 2, 8000); // 上限8秒
      }
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 認証
    const userId = getUserIdFromReq(req);

    // 日付
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }
    // クエリがなければデフォルトは「今日」
    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid startDate or endDate' });
    }

    // 並列集計（既存の処理を削らず維持）
    const [
      completedTasks,
      totalTime,
      tagsData,
      projectsData,
      totalTasks,
      topTaskData,
    ] = await Promise.all([
      // 完了タスク数（completed=true を updatedAt 範囲で集計）
      retry(() =>
        prisma.task.count({
          where: { userId, completed: true, updatedAt: { gte: start, lte: end } },
        })
      ),

      // 合計作業時間（TimeEntry）
      retry(() =>
        prisma.timeEntry.aggregate({
          _sum: { durationMinutes: true },
          where: {
            task: { userId },
            startTime: { gte: start, lte: end },
          },
        })
      ),

      // タグ別時間配分（Tag -> tasks -> timeEntries）
      retry(() =>
        prisma.tag.findMany({
          where: {
            tasks: {
              some: {
                userId,
                timeEntries: { some: { startTime: { gte: start, lte: end } } },
              },
            },
          },
          select: {
            name: true,
            tasks: {
              where: {
                userId,
                timeEntries: { some: { startTime: { gte: start, lte: end } } },
              },
              select: {
                timeEntries: {
                  where: { startTime: { gte: start, lte: end } },
                  select: { durationMinutes: true },
                },
              },
            },
          },
        })
      ),

      // プロジェクト別時間配分（Project -> tasks -> timeEntries）
      retry(() =>
        prisma.project.findMany({
          where: {
            tasks: {
              some: {
                userId,
                timeEntries: { some: { startTime: { gte: start, lte: end } } },
              },
            },
          },
          select: {
            name: true,
            tasks: {
              where: {
                userId,
                timeEntries: { some: { startTime: { gte: start, lte: end } } },
              },
              select: {
                timeEntries: {
                  where: { startTime: { gte: start, lte: end } },
                  select: { durationMinutes: true },
                },
              },
            },
          },
        })
      ),

      // 全タスク数（進捗率算出）
      retry(() =>
        prisma.task.count({
          where: { userId, createdAt: { gte: start, lte: end } },
        })
      ),

      // 最も時間を使ったタスク候補（Task -> timeEntries）
      retry(() =>
        prisma.task.findMany({
          where: {
            userId,
            timeEntries: { some: { startTime: { gte: start, lte: end } } },
          },
          select: {
            title: true,
            timeEntries: {
              where: { startTime: { gte: start, lte: end } },
              select: { durationMinutes: true },
            },
          },
        })
      ),
    ]);

    // タグ集計
    const tags = tagsData
      .map((tag) => ({
        tag: tag.name,
        minutes: tag.tasks.reduce(
          (sum, task) =>
            sum + task.timeEntries.reduce((s, te) => s + (te.durationMinutes ?? 0), 0),
          0
        ),
      }))
      .sort((a, b) => b.minutes - a.minutes);

    // プロジェクト集計
    const projects = projectsData
      .map((project) => ({
        project: project.name,
        minutes: project.tasks.reduce(
          (sum, task) =>
            sum + task.timeEntries.reduce((s, te) => s + (te.durationMinutes ?? 0), 0),
          0
        ),
      }))
      .sort((a, b) => b.minutes - a.minutes);

    // 進捗率
    const progressRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // 最も時間を使ったタスク
    let topTask: { task: string; minutes: number } | null = null;
    let maxMinutes = 0;
    for (const task of topTaskData) {
      const totalMinutes = task.timeEntries.reduce(
        (sum, te) => sum + (te.durationMinutes ?? 0),
        0
      );
      if (totalMinutes > maxMinutes) {
        maxMinutes = totalMinutes;
        topTask = { task: task.title, minutes: totalMinutes };
      }
    }

    const totalMinutes = totalTime._sum.durationMinutes ?? 0;

    return res.status(200).json({
      completedTasks,
      totalMinutes,
      totalHours: totalMinutes / 60,
      tags,
      projects,
      progressRate,
      topTask,
    });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('summary error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}