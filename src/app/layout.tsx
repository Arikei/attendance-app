import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "出席管理アプリ",
  description: "Simple Attendance App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}