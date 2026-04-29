import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "react-quill-new/dist/quill.snow.css";

export const metadata: Metadata = {
  title: "Mail Sistemi",
  description: "Otomatik Gönderim Paneli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {children}
        <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
