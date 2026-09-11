import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IC Panic Log Tool | IMEI Clear",
  description: "Translate iPhone panic-full logs into ranked hardware paths, evidence, and practical next checks.",
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
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
