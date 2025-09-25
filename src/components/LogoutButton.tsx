// 例: components/LogoutButton.tsx
import { useRouter } from "next/router";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      router.push("/login");
      return;
    }

    await fetch("/api/logout", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionId}`,
      },
    });

    // クライアント側のセッションIDも削除
    localStorage.removeItem("sessionId");

    // ログイン画面へリダイレクト
    router.push("/login");
  };

  return <button onClick={handleLogout}>ログアウト</button>;
}