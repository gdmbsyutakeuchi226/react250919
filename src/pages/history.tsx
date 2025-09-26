import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navigation from '../components/Navigation';

export default function HistoryPage() {
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // 期間フィルタ
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 月曜始まり
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return now.toISOString();
  });

  // 認証チェック
  useEffect(() => {
    const sid = localStorage.getItem("sessionId");
    if (!sid) {
      router.replace("/login");
      return;
    }
    setUser({ id: "session", name: "ログイン中" });
  }, [router]);

  // データ取得
  useEffect(() => {
    if (!user) return;
    fetchTimeEntries();
  }, [user, page, startDate, endDate]);

  async function fetchTimeEntries() {
    if (!user) return;
    
    setLoading(true);
    const t = localStorage.getItem('sessionId');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        startDate: startDate,
        endDate: endDate,
      });

      const res = await fetch(`/api/time-entry/history?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });

      if (!res.ok) {
        console.error('GET /api/time-entry/history failed', res.status, await res.text());
        return;
      }

      const data = await res.json();
      setTimeEntries(data.timeEntries);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Error fetching time entries:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("sessionId");
    router.push("/login");
  };

  if (!user) return <p>読み込み中...</p>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} onLogout={handleLogout} />
      
      <div className="mx-auto bg-white p-3 sm:p-4 md:p-6 lg:p-8 rounded-2xl shadow-lg w-full max-w-[90rem] mt-4 md:mt-6">
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-3 sm:mb-4 md:mb-6">
          タスク時間履歴
        </h1>

        {/* 期間選択フォーム */}
        <div className="mb-4 sm:mb-6 flex flex-wrap gap-3 sm:gap-4 items-end">
          <div className="flex-1 min-w-[140px] sm:min-w-[150px]">
            <label className="text-xs text-gray-500">開始日</label>
            <input
              type="date"
              className="border p-2 rounded w-full text-sm"
              value={startDate.slice(0, 10)}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const d = new Date(val + 'T00:00:00');
                  setStartDate(d.toISOString());
                }
              }}
            />
          </div>
          <div className="flex-1 min-w-[140px] sm:min-w-[150px]">
            <label className="text-xs text-gray-500">終了日</label>
            <input
              type="date"
              className="border p-2 rounded w-full text-sm"
              value={endDate.slice(0, 10)}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const d = new Date(val + 'T23:59:59');
                  setEndDate(d.toISOString());
                }
              }}
            />
          </div>
          <button
            onClick={fetchTimeEntries}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            検索
          </button>
        </div>

        {/* 時間記録テーブル */}
        <div className="overflow-x-auto">
          {loading && (
            <div className="text-center py-4 text-gray-600">
              読み込み中...
            </div>
          )}

          {!loading && timeEntries.length === 0 && (
            <div className="text-center py-4 text-gray-600">
              記録された時間がありません
            </div>
          )}

          {!loading && timeEntries.length > 0 && (
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-4 py-2 text-left">日付</th>
                  <th className="border px-4 py-2 text-left">タスク</th>
                  <th className="border px-4 py-2 text-left">開始時刻</th>
                  <th className="border px-4 py-2 text-left">終了時刻</th>
                  <th className="border px-4 py-2 text-left">作業時間</th>
                  <th className="border px-4 py-2 text-left">休憩時間</th>
                  <th className="border px-4 py-2 text-left">タグ</th>
                </tr>
              </thead>
              <tbody>
                {timeEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">
                      {new Date(entry.startTime).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="border px-4 py-2">
                      <div className="font-medium">{entry.task.title}</div>
                    </td>
                    <td className="border px-4 py-2">
                      {new Date(entry.startTime).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="border px-4 py-2">
                      {entry.endTime 
                        ? new Date(entry.endTime).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '-'
                      }
                    </td>
                    <td className="border px-4 py-2">
                      {entry.durationMinutes}分
                    </td>
                    <td className="border px-4 py-2">
                      {entry.breakMinutes || 0}分
                    </td>
                    <td className="border px-4 py-2">
                      {entry.task.tags && entry.task.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.task.tags.map((tag: any) => (
                            <span
                              key={tag.name}
                              className="text-xs px-2 py-0.5 bg-gray-200 text-gray-800 rounded"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ページング */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 text-sm"
            >
              前へ
            </button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 text-sm"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
