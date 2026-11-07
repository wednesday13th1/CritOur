import type { Metadata } from "next";
import "./globals.css";
import "./attachments.css";
import "./detail.css";
import "./admin.css";
import "./fixes.css";
import "./refine.css";
import "./content-update.css";
import "./ocean.css";
import "./admin-blue.css";

export const metadata: Metadata = {
  title: "motto. — Student Creative Studio",
  description: "Apps, websites and small ideas made by students in Japan.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
