import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id: number) => {
    const token = localStorage.getItem("token");
    await fetch("/api/admin/deleteUser", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    fetchUsers();
  };

  const handleRoleChange = async (id: number, newRole: string) => {
    const token = localStorage.getItem("token");
    await fetch("/api/admin/updateRole", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, role: newRole }),
    });
    fetchUsers();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">管理者モード：ユーザー管理</h1>
      {message && <p className="text-red-500">{message}</p>}

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">ID</th>
            <th className="border px-4 py-2">Email</th>
            <th className="border px-4 py-2">Role</th>
            <th className="border px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="border px-4 py-2">{u.id}</td>
              <td className="border px-4 py-2">{u.email}</td>
              <td className="border px-4 py-2">{u.role}</td>
              <td className="border px-4 py-2 space-x-2">
                <button
                  onClick={() => handleDelete(u.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  削除
                </button>
                <button
                  onClick={() => handleRoleChange(u.id, u.role === "user" ? "admin" : "user")}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  {u.role === "user" ? "管理者にする" : "ユーザーに戻す"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
