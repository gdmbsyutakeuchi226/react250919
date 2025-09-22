// pages/api/_utils/auth.ts
import type { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';

export function getUserIdFromReq(req: NextApiRequest): number {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw new Error('Unauthorized');
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not defined');
    throw new Error('Unauthorized');
  }

  try {
    const payload = jwt.verify(token, secret) as any;
    const uid = Number(payload?.id ?? payload?.userId);
    if (!Number.isInteger(uid) || uid <= 0) throw new Error('Unauthorized');
    return uid;
  } catch (e) {
    throw new Error('Unauthorized');
  }
}