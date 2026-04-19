import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paste a Lead",
  description: "Paste a lead and instantly see if it’s worth pursuing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}