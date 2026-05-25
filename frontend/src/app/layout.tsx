import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Orebit Market — Asteroid Intelligence Platform",
  description:
    "Real-time asteroid intelligence radar. Track near-Earth asteroids, value them against live commodity markets, and plan optimal mining missions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased bg-black text-white">
        {children}
      </body>
    </html>
  );
}
