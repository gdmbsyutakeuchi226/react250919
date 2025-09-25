// pages/api/tasks/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getUserIdFromReq } from '../_utils/auth';

function parseBool(val?: string) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromReq(req);

    if (req.method === 'GET') {
      const {
        page = '1',
        limit = '10',
        q,
        priority,
        status,
        completed,
        dateFrom,
        dateTo,
        tag,
      } = req.query as Record<string, string | undefined>;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const take = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 10));
      const skip = (pageNum - 1) * take;

      const where: any = { userId };

      if (q && q.trim()) where.title = { contains: q.trim(), mode: 'insensitive' };
      if (priority) where.priority = priority;
      if (status) where.status = status;
      const completedBool = parseBool(completed);
      if (completedBool !== undefined) where.completed = completedBool;
      if (dateFrom || dateTo) {
        where.dueDate = {};
        if (dateFrom) where.dueDate.gte = new Date(dateFrom);
        if (dateTo) where.dueDate.lte = new Date(dateTo);
      }
      // tag フィルタ（カンマ区切り: いずれか一致でヒット）
      if (tag && tag.trim()) {
        const names = tag
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        if (names.length) {
          where.tags = {
            some: { name: { in: names } },
          };
        }
      }

      const [total, tasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
          where,
          include: { tags: { select: { id: true, name: true } } },
          orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
          skip,
          take,
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / take));
      return res.status(200).json({ tasks, totalPages });
    }

    if (req.method === 'POST') {
      const { title, description, priority, status, dueDate, tags } = req.body || {};
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Invalid title' });
      }

      const tagNames: string[] =
        typeof tags === 'string'
          ? tags
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : Array.isArray(tags)
          ? (tags as string[]).map((t) => t.trim()).filter(Boolean)
          : [];

      const created = await prisma.task.create({
        data: {
          title: title.trim(),
          description: description ?? null,
          priority: priority ?? 'MEDIUM',
          status: status ?? 'NOT_STARTED',
          dueDate: dueDate ? new Date(dueDate) : null,
          userId,
          // 並び順は末尾へ（最大order+1）
          order:
            ((await prisma.task.aggregate({
              where: { userId },
              _max: { order: true },
            }))?._max?.order ?? 0) + 1,
          tags: {
            connectOrCreate: tagNames.map((name) => ({
              where: { name },
              create: { name },
            })),
          },
        },
        include: { tags: { select: { id: true, name: true } } },
      });

      return res.status(201).json(created);
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    console.error('tasks index error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}