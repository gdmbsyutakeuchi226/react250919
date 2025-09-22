export const config = {
  runtime: 'nodejs',
};
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'メールアドレスが必要です' });

  try {
    // ユーザー検索
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'ユーザーが見つかりません' });

    // トークン生成
    const token = crypto.randomBytes(32).toString('hex');

    // 既存トークン削除（任意）
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // トークン保存（有効期限1時間）
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expires: new Date(Date.now() + 3600000),
      },
    });

    // Nodemailer 設定
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password/${token}`;

    await transporter.sendMail({
      from: `"サポート" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'パスワード再設定リンク',
      text: `以下のリンクからパスワードを再設定してください（1時間有効）:\n${resetUrl}`,
      html: `<p>以下のリンクからパスワードを再設定してください（1時間有効）:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    return res.status(200).json({ message: '再設定リンクを送信しました' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'サーバーエラー', error: String(err) });
  }
}