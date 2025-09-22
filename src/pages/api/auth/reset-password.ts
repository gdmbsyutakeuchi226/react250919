export const config = {
  runtime: 'nodejs',
};
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'トークンとパスワードが必要です' });

  try {
    // トークン検証
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.expires < new Date()) {
      return res.status(400).json({ message: 'トークンが無効または期限切れです' });
    }

    // パスワード更新
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    });

    // トークン削除
    await prisma.passwordResetToken.delete({ where: { token } });

    return res.status(200).json({ message: 'パスワードを更新しました' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'サーバーエラー', error: String(err) });
  }
}