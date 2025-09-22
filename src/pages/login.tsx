import { useState } from "react";
import { useRouter } from "next/router";
import { Link } from "lucide-react";
import Link2 from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      console.log("Login response token:", data.token);  // ← これを追加
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } else {
      setMessage(data.message || "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-lg w-80">
        <h1 className="text-xl font-bold mb-4 text-center">ログイン</h1>

        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full mb-3 rounded"
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full mb-3 rounded"
        />

        <button type="submit" className="bg-green-600 text-white py-2 rounded w-full hover:bg-green-700">
          ログイン
        </button>
        <Link2 href="/reset-password" className="text-blue-500 hover:underline">
          パスワードを忘れた場合
        </Link2>
        {message && <p className="mt-3 text-center text-sm text-red-500">{message}</p>}
      </form>
    </div>
  );
}
