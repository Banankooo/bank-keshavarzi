import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "سامانه پایش هوشمند اخبار ۲۴ ساعته | روابط عمومی بانک کشاورزی استان مازندران",
  description:
    "پرتال اختصاصی جستجوی زنده گوگل و رصد اخبار ۲۴ ساعته بانک کشاورزی و استانداری مازندران ویژه رئیس روابط عمومی مدیریت شعب استان مازندران",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F8F9F6] text-[#0F1E16] antialiased selection:bg-[#0B5D3B]/15 selection:text-[#0B5D3B]">
        {children}
      </body>
    </html>
  );
}
