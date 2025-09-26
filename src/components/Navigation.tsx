import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NavigationProps {
  user: { id: string; name: string } | null;
  onLogout: () => void;
}

export default function Navigation({ user, onLogout }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = () => {
    onLogout();
    setIsOpen(false);
  };

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* ロゴ・タイトル */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold text-gray-900">
              {user ? `${user.name} のTODO管理` : 'TODO管理'}
            </h1>
          </div>

          {/* PC用ナビゲーション（横並び） */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                ダッシュボード
              </button>
              <button
                onClick={() => router.push('/history')}
                className="text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                タスク時間履歴
              </button>
              <button
                onClick={handleLogout}
                className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>

          {/* モバイル用ハンバーガーボタン */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-900 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded="false"
            >
              <span className="sr-only">メニューを開く</span>
              {/* ハンバーガーアイコン */}
              <svg
                className={`${isOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              {/* 閉じるアイコン */}
              <svg
                className={`${isOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* モバイル用メニュー（スライドダウン） */}
      <div className={`md:hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50 border-t">
          <button
            onClick={() => {
              router.push('/dashboard');
              setIsOpen(false);
            }}
            className="text-gray-900 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors"
          >
            ダッシュボード
          </button>
          <button
            onClick={() => {
              router.push('/history');
              setIsOpen(false);
            }}
            className="text-gray-900 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors"
          >
            タスク時間履歴
          </button>
          <button
            onClick={handleLogout}
            className="text-red-600 hover:bg-red-50 block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </nav>
  );
}
