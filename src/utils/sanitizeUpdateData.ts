// utils/sanitizeUpdateData.ts
export function sanitizeUpdateData(raw: any) {
  const forbidden = ['id', 'cid', 'createdAt', 'updatedAt'];
  const data: any = {};

  for (const key in raw) {
    if (forbidden.includes(key)) continue;
    if (raw[key] === undefined) continue;

    // 日付フィールドはDate型に変換
    if (key.toLowerCase().includes('date') && raw[key]) {
      data[key] = new Date(raw[key]);
    } else {
      data[key] = raw[key];
    }
  }
  return data;
}