import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Noemia",
  description: "Turn vague thoughts into clear, actionable outcomes.",
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
