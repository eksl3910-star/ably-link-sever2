import type { Metadata } from "next";
import "./globals.css";
import { DevToolsGuard } from "./DevToolsGuard";

export const metadata: Metadata = {
  title: "에이블리 옷장 맞교",
  description: "에이블리 옷장 링크를 서로 맞교해요",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-full flex flex-col antialiased"
        style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        <DevToolsGuard />
        {children}
      </body>
    </html>
  );
}
