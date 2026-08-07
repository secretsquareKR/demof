import Footer from '@/app/components/Footer';
import Header from '@/app/components/Header';
import type { Metadata } from "next";
//import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "Dimof STUDIO | 나만의 굿즈 제작",
  description: "하나뿐인 나만의 굿즈 제작 전문 디모프 입니다.",
  other: {
    'color-scheme': 'light',
    'supported-color-schemes': 'light',
  }
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    
    <html
      lang="ko"
      // className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      
    <meta name="color-scheme" content="light"></meta>
    <meta name="supported-color-schemes" content="light"></meta>
            
    
          <body className="min-h-full flex flex-col">
            <Header />
            {children}
            <Footer />
      </body>
    </html>
  );
}

