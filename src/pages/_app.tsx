import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const removeOverlay = () => {
      // Next.js のエラーオーバーレイを削除
      document.querySelectorAll('nextjs-portal').forEach((portal) => {
        portal.remove();
      });
    };

    // 初回実行
    removeOverlay();

    // 0.5秒ごとに監視して削除
    const interval = setInterval(removeOverlay, 500);

    return () => clearInterval(interval);
  }, []);

  return <Component {...pageProps} />;
}