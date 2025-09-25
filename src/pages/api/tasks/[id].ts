// pages/api/tasks/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromReq(req);
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid id' });

    // 対象タスクがユーザーの所有であることを保証
    const target = await prisma.task.findFirst({ where: { id, userId } });
    if (!target) return res.status(404).json({ message: 'Not found' });

    if (req.method === 'PUT') {
      const { title, description, priority, status, dueDate, completed, progress, tags } = req.body || {};

      const data: any = {};
      if (title !== undefined) data.title = String(title);
      if (description !== undefined) data.description = description ?? null;
      if (priority !== undefined) data.priority = priority;
      if (status !== undefined) data.status = status;
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
      if (completed !== undefined) data.completed = Boolean(completed);
      if (progress !== undefined) data.progress = Number(progress);

      // タグの置換（全入れ替え）
      let tagsUpdate = undefined as any;
      if (tags !== undefined) {
        const tagNames: string[] = Array.isArray(tags)
          ? (tags as string[]).map((t) => t.trim()).filter(Boolean)
          : typeof tags === 'string'
          ? tags
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : [];
        tagsUpdate = {
          set: [], // まず全解除
          connectOrCreate: tagNames.map((name) => ({
            where: { name },
            create: { name },
          })),
        };
      }

      const updated = await prisma.task.update({
        where: { id },
        data: { ...data, ...(tagsUpdate ? { tags: tagsUpdate } : {}) },
        include: { tags: { select: { id: true, name: true } } },
      });

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const taskId = Number(req.query.id);

      // 関連する TimeEntry を先に削除
      await prisma.timeEntry.deleteMany({
        where: { taskId },
      });

      // その後タスクを削除
      await prisma.task.delete({
        where: { id: taskId },
      });

      return res.status(204).end();
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('task [id] error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}