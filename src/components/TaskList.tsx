import { useEffect, useState } from 'react';
import { fetchTasks, updateTask, deleteTask } from '@/lib/api/tasks';

export default function TaskList() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [page] = useState(1);
  const [limit] = useState(10);

  useEffect(() => {
    loadTasks();
  }, [page]);

  async function loadTasks() {
    try {
      const { tasks } = await fetchTasks(page, limit);
      setTasks(tasks);
    } catch (err) {
      console.error('タスク取得失敗:', err);
    }
  }

  async function handleUpdate(id: number, changes: any) {
    // 楽観的更新（id一致のみ）
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, ...changes } : task
      )
    );

    try {
      await updateTask(id, changes);
      // 成功後は必ず最新データで上書き（強制UI更新）
      await loadTasks();
    } catch (err) {
      console.error('更新失敗:', err);
      // エラー時も最新状態に戻す
      await loadTasks();
    }
    }

    async function handleDelete(id: number) {
    const snapshot = todos; // 復元用
    setTodos(prev => prev.filter(t => t.id !== id)); // 楽観的に即時反映

    try {
        await deleteTaskSafe(id);
        // 必要なら再取得で正確性を担保
        // await fetchTasks(page, limit);
    } catch (e) {
        console.error('Delete failed:', e);
        setTodos(snapshot); // 失敗時復元
    }
    }

  return (
    <table>
      <thead>
        <tr>
          <th>タイトル</th>
          <th>優先度</th>
          <th>期限</th>
          <th>ステータス</th>
          <th>タグ</th>
          <th>重要度</th>
          <th>削除</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map(task => (
          <tr key={task.id}>
            <td>
              <input
                value={task.title || ''}
                onChange={e => handleUpdate(task.id, { title: e.target.value })}
              />
            </td>
            <td>
              <select
                value={task.priority || 'MEDIUM'}
                onChange={e => handleUpdate(task.id, { priority: e.target.value })}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </td>
            <td>
              <input
                type="date"
                value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                onChange={e => handleUpdate(task.id, { dueDate: e.target.value })}
              />
            </td>
            <td>
              <select
                value={task.status || 'NOT_STARTED'}
                onChange={e => handleUpdate(task.id, { status: e.target.value })}
              >
                <option value="NOT_STARTED">NOT_STARTED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </td>
            <td>
              <input
                value={task.tags?.map((t: any) => t.name).join(', ') || ''}
                onChange={e =>
                  handleUpdate(task.id, {
                    tags: e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </td>
            <td>{task.importance ?? ''}</td>
            <td>
              <button onClick={() => handleDelete(task.id)}>削除</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}