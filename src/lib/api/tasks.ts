// pages/api/tasks/[id].ts
import { prisma } from '@/lib/prisma';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // robust id parse (array-safe)
  const idRaw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = Number(idRaw);

  if (!Number.isInteger(id) || id <= 0) {
    console.warn('[tasks/[id]] Invalid id:', { idRaw, parsed: id });
    return res.status(400).json({ message: 'Invalid task ID' });
  }

  try {
    if (req.method === 'GET') {
      const task = await prisma.task.findUnique({
        where: { id },
        include: { tags: true, user: true },
      });
      if (!task) return res.status(404).json({ message: 'Task not found' });
      return res.status(200).json({
        ...task,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        tags: Array.isArray(task.tags) ? task.tags : [],
      });
    }

    if (req.method === 'PUT') {
      const data: any = { ...req.body };

      if (data.tags) {
        const tagNames = Array.isArray(data.tags)
          ? data.tags.map(String).map(s => s.trim()).filter(Boolean)
          : typeof data.tags === 'string'
          ? data.tags.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        data.tags = {
          set: [],
          connectOrCreate: tagNames.map(name => ({
            where: { name },
            create: { name },
          })),
        };
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: '更新内容が空です' });
      }

      const updated = await prisma.task.update({
        where: { id },
        data,
        include: { tags: true, user: true },
      });

      return res.status(200).json({
        ...updated,
        dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        tags: Array.isArray(updated.tags) ? updated.tags : [],
      });
    }

    if (req.method === 'DELETE') {
      const existing = await prisma.task.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ message: 'Task not found' });

      await prisma.task.delete({ where: { id } });
      return res.status(204).end();
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (err: any) {
    console.error(`Error in /api/tasks/${id}:`, err);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
}