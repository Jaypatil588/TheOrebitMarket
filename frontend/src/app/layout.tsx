import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASTROHEDGE // Asteroid Intelligence Telemetry",
  description: "Real-time deep space mining radar and telemetry network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-black text-slate-100">
        {children}
      </body>
    </html>
  );
}
