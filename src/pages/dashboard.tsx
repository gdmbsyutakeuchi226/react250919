// app/dashboard/page.tsx or pages/dashboard.tsx
// app/dashboard/page.tsx or pages/dashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

type Tag = { id: number; name: string };
type Task = {
  id: number;
  title: string;
  description?: string | null;
  completed: boolean;
  progress: number;
  priority: Priority;
  status: Status;
  dueDate?: string | null;
  tags: Tag[];
  isEditing?: boolean;
};
type SummaryData = {
  completedTasks: number;
  totalMinutes: number;
  totalHours: number;
  tags: { tag: string; minutes: number }[];
  projects: { project: string; minutes: number }[];
  progressRate: number;
  topTask: { task: string; minutes: number } | null;
};

export default function Dashboard() {
  // 認証・ユーザー
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const token = useMemo(
    () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null),
    []
  );

  // データ本体
  const [todos, setTodos] = useState<Task[]>([]);

  // ページング
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // 追加フォーム
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('MEDIUM');
  const [newStatus, setNewStatus] = useState<Status>('NOT_STARTED');
  const [newDue, setNewDue] = useState<string>('');
  const [newTags, setNewTags] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');

  // フィルタ
  const [q, setQ] = useState('');
  const [fPriority, setFPriority] = useState<'' | Priority>('');
  const [fStatus, setFStatus] = useState<'' | Status>('');
  const [fCompleted, setFCompleted] = useState<'' | 'true' | 'false'>('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo] = useState('');
  const [fTag, setFTag] = useState(''); // カンマ区切りOK

  // タグ候補（オートコンプリート用）
  const [tagList, setTagList] = useState<string[]>([]);

  // 既存 state に加えて summary 用 state を追加
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // state
  const [manualTaskId, setManualTaskId] = useState<number | ''>('');
  const [manualStart, setManualStart] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10) + 'T09:00';
  });
  const [manualEnd, setManualEnd] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10) + 'T17:00';
  });
  

  // 期間フィルタ（例: 今週）
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

  // 初期認証チェック
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.replace('/login');
      return;
    }
    try {
      const decoded: any = jwtDecode(t);
      setUser(decoded);
    } catch {
      localStorage.removeItem('token');
      router.replace('/login');
    }
  }, [router]);

  // データ読み込み
  useEffect(() => {
    if (!user) return;
    fetchTasks();
    fetchTags();
  }, [user, page, limit]);

  // 初期ロード & 期間変更時に summary を取得（成功するまで無限リトライ）
  useEffect(() => {
    // JSX内でジェネリクスを使うため <T,> にしている点に注意
    const retryUntilSuccess = async <T,>(fn: () => Promise<T>, delayMs = 1000): Promise<T> => {
      while (true) {
        try {
          return await fn();
        } catch (err) {
          console.error('fetchSummary 失敗:', err);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    };

    const fetchSummary = async () => {
      setLoadingSummary(true);
      setSummaryError(null);

      try {
        const data = await retryUntilSuccess(async () => {
          const res = await fetch(
            `/api/dashboard/summary?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
              },
            }
          );
          if (!res.ok) throw new Error(`Failed to fetch summary: ${res.status}`);
          return res.json();
        });

        setSummary(data);
      } catch (err: any) {
        setSummaryError(err.message || 'Error fetching summary');
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [startDate, endDate]);


  function buildQuery() {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (q.trim()) params.set('q', q.trim());
    if (fPriority) params.set('priority', fPriority);
    if (fStatus) params.set('status', fStatus);
    if (fCompleted) params.set('completed', fCompleted);
    if (fDateFrom) params.set('dateFrom', fDateFrom);
    if (fDateTo) params.set('dateTo', fDateTo);
    if (fTag.trim()) params.set('tag', fTag.trim());
    return params.toString();
  }

  async function fetchTasks() {
    const t = localStorage.getItem('token');
    const qs = buildQuery();
    const res = await fetch(`/api/tasks?${qs}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      console.error('GET /api/tasks failed', res.status, await res.text());
      return;
    }
    const data = await res.json();
    setTodos(data.tasks);
    setTotalPages(data.totalPages);
  }

  async function fetchTags() {
    const t = localStorage.getItem('token');
    try {
      const res = await fetch('/api/tags', {
        headers: { Authorization: `Bearer ${t}` },
      });

      if (!res.ok) {
        console.error('GET /api/tags failed', res.status, await res.text());
        return;
      }

      const data = await res.json();
      console.log('tags API response:', data);

      if (Array.isArray(data)) {
        const names = data
          .map((tag: any) => (typeof tag === 'string' ? tag : tag?.name))
          .filter((name: any): name is string => Boolean(name))
          .sort((a: string, b: string) => a.localeCompare(b, 'ja'));
        setTagList(names);
      } else if (data && Array.isArray(data.tags)) {
        const names = data.tags
          .map((tag: any) => (typeof tag === 'string' ? tag : tag?.name))
          .filter((name: any): name is string => Boolean(name))
          .sort((a: string, b: string) => a.localeCompare(b, 'ja'));
        setTagList(names);
      } else {
        setTagList([]);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
      setTagList([]);
    }
  }

  async function addTask() {
    const titleTrimmed = newTitle.trim();
    if (!titleTrimmed) {
      alert('タイトルを入力してください');
      return;
    }
    const t = localStorage.getItem('token');
    const payload = {
      title: titleTrimmed,
      description: newDesc?.trim() || null,
      priority: newPriority,
      status: newStatus,
      dueDate: newDue || null,
      tags: newTags?.trim() || '',
    };
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('POST /api/tasks failed', res.status, await res.text());
      alert('追加に失敗しました');
      return;
    }
    await fetchTasks();
    setNewTitle('');
    setNewDesc('');
    setNewDue('');
    setNewTags('');
    setNewPriority('MEDIUM');
    setNewStatus('NOT_STARTED');
  }

  async function updateTask(
    id: number,
    updates: Partial<Task> & { tags?: string[] | null; dueDate?: string | null }
  ) {
    const t = localStorage.getItem('token');
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      console.error('PUT /api/tasks/:id failed', res.status, await res.text());
      return;
    }
    const updated = await res.json();
    setTodos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function deleteTask(id: number) {
    const t = localStorage.getItem('token');
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok || res.status === 204) {
      await fetchTasks();
    } else {
      console.error('DELETE /api/tasks/:id failed', res.status, await res.text());
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(todos);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setTodos(reordered);

    const t = localStorage.getItem('token');
    await fetch(`/api/tasks/reorder?${buildQuery()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ ids: reordered.map((x) => x.id) }),
    });
    await fetchTasks();
  };


  // 関数
  async function submitManualTime() {
    if (!manualTaskId || !manualStart || !manualEnd) {
      alert('全ての項目を入力してください');
      return;
    }

    try {
      const res = await fetch('/api/time-entry/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          taskId: manualTaskId,
          startTime: manualStart,
          endTime: manualEnd,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to record time');
      }

      alert('時間を記録しました');
      setManualTaskId('');
      setManualStart('');
      setManualEnd('');

      // 記録後、サマリーを即時再取得（現在の期間フィルタを反映）
      const resSummary = await fetch(
        `/api/dashboard/summary?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        }
      );

      if (!resSummary.ok) {
        const errText = await resSummary.text();
        throw new Error(errText || 'Failed to fetch summary');
      }

      const data = await resSummary.json();
      setSummary(data);
    } catch (err: any) {
      console.error('submitManualTime error:', err);
      alert(err?.message || 'エラーが発生しました');
    }
  }

  if (!user) return <p>読み込み中...</p>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto bg-white p-6 rounded-2xl shadow-lg w-full max-w-[90rem]">
        <h1 className="text-2xl font-bold mb-4">
          ID : {user.id} - {user.name} のTODOリスト
        </h1>
        {/* 集計期間プリセットボタン */}
        <div className="flex gap-2 mb-4">
          <button
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              setStartDate(today.toISOString());
              const end = new Date();
              end.setHours(23, 59, 59, 999);
              setEndDate(end.toISOString());
            }}
          >
            今日
          </button>
          <button
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => {
              const now = new Date();
              const day = now.getDay();
              const diff = now.getDate() - day + (day === 0 ? -6 : 1);
              const monday = new Date(now.setDate(diff));
              monday.setHours(0, 0, 0, 0);
              setStartDate(monday.toISOString());
              const end = new Date();
              end.setHours(23, 59, 59, 999);
              setEndDate(end.toISOString());
            }}
          >
            今週
          </button>
          <button
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => {
              const first = new Date();
              first.setDate(1);
              first.setHours(0, 0, 0, 0);
              setStartDate(first.toISOString());
              const end = new Date(first.getFullYear(), first.getMonth() + 1, 0);
              end.setHours(23, 59, 59, 999);
              setEndDate(end.toISOString());
            }}
          >
            今月
          </button>
        </div>

        {/* 期間選択フォーム */}
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500">開始日</label>
            <input
              type="date"
              className="border p-2 rounded"
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
          <div>
            <label className="text-xs text-gray-500">終了日</label>
            <input
              type="date"
              className="border p-2 rounded"
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
        </div>

        {/* サマリー表示 */}
        {loadingSummary && (
          <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded">
            サマリーを読み込み中...
          </div>
        )}
        {summaryError && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded">
            サマリーの取得に失敗しました: {summaryError}
          </div>
        )}
        {summary && !loadingSummary && !summaryError && (
          <div className="space-y-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded shadow">
                <h2 className="text-sm font-bold text-gray-500">完了タスク数</h2>
                <p className="text-2xl font-bold">{summary.completedTasks}</p>
              </div>
              <div className="p-4 bg-white rounded shadow">
                <h2 className="text-sm font-bold text-gray-500">合計作業時間</h2>
                <p className="text-2xl font-bold">{summary.totalHours.toFixed(1)} 時間</p>
              </div>
              <div className="p-4 bg-white rounded shadow">
                <h2 className="text-sm font-bold text-gray-500">進捗率</h2>
                <p className="text-2xl font-bold">{summary.progressRate.toFixed(1)}%</p>
              </div>
            </div>

            {summary.tags.length > 0 && (
              <div className="p-4 bg-white rounded shadow">
                <h2 className="text-sm font-bold text-gray-500 mb-2">タグ別時間配分</h2>
                <ul className="space-y-1">
                  {summary.tags.map((t) => (
                    <li key={t.tag} className="flex justify-between border-b pb-1">
                      <span>{t.tag}</span>
                      <span>{t.minutes} 分</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.topTask && (
              <div className="p-4 bg-white rounded shadow">
                <h2 className="text-sm font-bold text-gray-500 mb-1">最も時間を使ったタスク</h2>
                <p className="text-lg font-semibold">{summary.topTask.task}</p>
                <p className="text-sm text-gray-600">{summary.topTask.minutes} 分</p>
              </div>
            )}
          </div>
        )}

        {/* 日ごとの時間記録フォーム */}
        <div className="mb-6 p-4 bg-blue-50 rounded shadow">
          <h2 className="text-lg font-bold mb-2">日ごとの時間記録</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-xs text-gray-500">対象タスク</label>
              <select
                className="border p-2 rounded w-full"
                value={manualTaskId}
                onChange={(e) => setManualTaskId(Number(e.target.value))}
              >
                <option value="">選択してください</option>
                {todos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">日付</label>
              <input
                type="date"
                className="border p-2 rounded w-full"
                value={manualStart.slice(0, 10)}
                onChange={(e) => {
                  const date = e.target.value;
                  if (date) {
                    setManualStart(date + 'T09:00');
                    setManualEnd(date + 'T17:00');
                  }
                }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">開始時刻</label>
              <input
                type="time"
                className="border p-2 rounded w-full"
                value={manualStart.slice(11, 16)}
                onChange={(e) => {
                  const time = e.target.value;
                  if (time && manualStart) {
                    setManualStart(manualStart.slice(0, 10) + 'T' + time);
                  }
                }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">終了時刻</label>
              <input
                type="time"
                className="border p-2 rounded w-full"
                value={manualEnd.slice(11, 16)}
                onChange={(e) => {
                  const time = e.target.value;
                  if (time && manualEnd) {
                    setManualEnd(manualEnd.slice(0, 10) + 'T' + time);
                  }
                }}
              />
            </div>
            <div>
              <button
                onClick={submitManualTime}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
              >
                記録
              </button>
            </div>
          </div>
        </div>


        {/* フィルタフォーム */}
        <h2 className="text-lg font-bold mb-2">フィルタフォーム</h2>
        <div className="mb-3 grid grid-cols-12 gap-2 items-end">
          <div className="col-span-3">
            <label className="text-xs text-gray-500">タイトル</label>
            <input
              className="border p-2 rounded w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="部分一致"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">優先度</label>
            <select
              className="border p-2 rounded w-full"
              value={fPriority}
              onChange={(e) => setFPriority(e.target.value as any)}
            >
              <option value="">すべて</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">ステータス</label>
            <select
              className="border p-2 rounded w-full"
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value as any)}
            >
              <option value="">すべて</option>
              <option value="NOT_STARTED">NOT_STARTED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">完了</label>
            <select
              className="border p-2 rounded w-full"
              value={fCompleted}
              onChange={(e) => setFCompleted(e.target.value as any)}
            >
              <option value="">すべて</option>
              <option value="true">完了</option>
              <option value="false">未完了</option>
            </select>
          </div>
          <div className="col-span-1">
            <label className="text-xs text-gray-500">期限(自)</label>
            <input
              type="date"
              className="border p-2 rounded w-full"
              value={fDateFrom}
              onChange={(e) => setFDateFrom(e.target.value)}
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-gray-500">期限(至)</label>
            <input
              type="date"
              className="border p-2 rounded w-full"
              value={fDateTo}
              onChange={(e) => setFDateTo(e.target.value)}
            />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-500">タグ（カンマ区切り）</label>
            <input
              list="tag-suggestions"
              className="border p-2 rounded w-full"
              value={fTag}
              onChange={(e) => setFTag(e.target.value)}
              placeholder="shopping, home..."
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <button
              onClick={() => {
                setPage(1);
                fetchTasks();
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
            >
              検索
            </button>
            <button
              onClick={() => {
                setQ('');
                setFPriority('');
                setFStatus('');
                setFCompleted('');
                setFDateFrom('');
                setFDateTo('');
                setFTag('');
                setPage(1);
                fetchTasks();
              }}
              className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 w-full"
            >
              クリア
            </button>
          </div>
        </div>

        {/* 追加フォーム */}
        <h2 className="text-lg font-bold mb-2">タスク追加</h2>
        <div className="grid grid-cols-12 gap-2 mb-4">
          
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="border p-2 rounded col-span-4"
            placeholder="タイトル"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="border p-2 rounded col-span-3"
            placeholder="説明（任意）"
          />
          <select
            className="border p-2 rounded col-span-2"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Priority)}
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
          <select
            className="border p-2 rounded col-span-2"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as Status)}
          >
            <option value="NOT_STARTED">NOT_STARTED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
          <input
            type="date"
            className="border p-2 rounded col-span-3"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
          />
          <input
            list="tag-suggestions"
            type="text"
            className="border p-2 rounded col-span-4"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="タグ（カンマ区切り、候補から選択可）"
          />
          <button
            onClick={addTask}
            className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 col-span-2"
          >
            追加
          </button>
        </div>

        {/* タグ候補 datalist（フィルタ・追加・編集インプットで共有） */}
        <datalist id="tag-suggestions">
          {tagList.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>

        {/* D&Dテーブル */}
        <div className="overflow-x-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="todos">
              {(provided) => (
                <table
                  className="w-full table-fixed border-collapse"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 w-16">完了</th>
                      <th className="p-2 w-[24rem]">タイトル</th>
                      <th className="p-2 w-24">優先</th>
                      <th className="p-2 w-32">期限</th>
                      <th className="p-2 w-32">ステータス</th>
                      <th className="p-2 w-[24rem]">タグ</th>
                      <th className="p-2 w-40">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todos.map((todo, index) => (
                      <Draggable
                        key={todo.id}
                        draggableId={String(todo.id)}
                        index={index}
                      >
                        {(provided) => (
                          <tr
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="border-b"
                            style={provided.draggableProps.style}
                          >
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={todo.completed}
                                onChange={(e) =>
                                  updateTask(todo.id, {
                                    completed: e.target.checked,
                                  })
                                }
                              />
                            </td>

                            <td className="p-2 truncate">
                              {todo.isEditing ? (
                                <input
                                  type="text"
                                  defaultValue={todo.title}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    updateTask(todo.id, { title: v || todo.title });
                                    setTodos((prev) =>
                                      prev.map((t) =>
                                        t.id === todo.id
                                          ? { ...t, isEditing: false }
                                          : t
                                      )
                                    );
                                  }}
                                  autoFocus
                                  className="border p-1 w-full"
                                />
                              ) : (
                                <span
                                  className="cursor-text"
                                  onDoubleClick={() =>
                                    setTodos((prev) =>
                                      prev.map((t) =>
                                        t.id === todo.id
                                          ? { ...t, isEditing: true }
                                          : t
                                      )
                                    )
                                  }
                                >
                                  {todo.title}
                                </span>
                              )}
                            </td>

                            <td className="p-2">
                              <select
                                className="border p-1 rounded w-full"
                                value={todo.priority}
                                onChange={(e) =>
                                  updateTask(todo.id, {
                                    priority: e.target.value as Priority,
                                  })
                                }
                              >
                                <option value="LOW">LOW</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="HIGH">HIGH</option>
                              </select>
                            </td>

                            <td className="p-2">
                              <input
                                type="date"
                                className="border p-1 rounded w-full"
                                value={todo.dueDate ? todo.dueDate.slice(0, 10) : ''}
                                onChange={(e) => {
                                  const dateStr = e.target.value;
                                  updateTask(todo.id, {
                                    dueDate: dateStr
                                      ? new Date(dateStr + 'T00:00:00').toISOString()
                                      : null,
                                  });
                                }}
                              />
                            </td>

                            <td className="p-2">
                              <select
                                className="border p-1 rounded w-full"
                                value={todo.status}
                                onChange={(e) =>
                                  updateTask(todo.id, {
                                    status: e.target.value as Status,
                                  })
                                }
                              >
                                <option value="NOT_STARTED">NOT_STARTED</option>
                                <option value="IN_PROGRESS">IN_PROGRESS</option>
                                <option value="COMPLETED">COMPLETED</option>
                              </select>
                            </td>

                            <td className="p-2">
                              <input
                                list="tag-suggestions"
                                type="text"
                                className="border p-1 rounded w-full"
                                defaultValue={todo.tags?.map((t) => t.name).join(', ')}
                                onBlur={(e) => {
                                  const tagsArray = e.target.value
                                    .split(',')
                                    .map((t) => t.trim())
                                    .filter(Boolean);
                                  updateTask(todo.id, { tags: tagsArray as any });
                                }}
                                placeholder="tag1, tag2"
                              />
                              <div className="mt-1 flex flex-wrap gap-1">
                                {todo.tags?.map((t) => {
                                  let colorClass = 'bg-gray-200 text-gray-800';
                                  if (/重要|high/i.test(t.name)) colorClass = 'bg-red-200 text-red-800';
                                  else if (/中|medium/i.test(t.name)) colorClass = 'bg-yellow-200 text-yellow-800';
                                  else if (/低|low/i.test(t.name)) colorClass = 'bg-green-200 text-green-800';

                                  return (
                                    <span
                                      key={t.id}
                                      className={`text-xs px-2 py-0.5 rounded ${colorClass}`}
                                    >
                                      {t.name}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            <td className="p-2">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() =>
                                    setTodos((prev) =>
                                      prev.map((t) =>
                                        t.id === todo.id
                                          ? { ...t, isEditing: !t.isEditing }
                                          : t
                                      )
                                    )
                                  }
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                                >
                                  {todo.isEditing ? '保存' : '編集'}
                                </button>
                                <button
                                  onClick={() => deleteTask(todo.id)}
                                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                                >
                                  削除
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </tbody>
                </table>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* ページング */}
        <div className="flex items-center gap-3 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            前へ
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            次へ
          </button>
          <select
            className="ml-auto border p-1 rounded"
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
          >
            <option value={5}>5件</option>
            <option value={10}>10件</option>
            <option value={20}>20件</option>
            <option value={50}>50件</option>
          </select>
        </div>

        {/* ログアウト */}
        <div className="mt-6 flex justify-start">
          <button
            onClick={() => {
              localStorage.removeItem('token');
              router.push('/login');
            }}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}