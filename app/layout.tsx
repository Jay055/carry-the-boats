import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carry the Boats — Training System",
  description: "A 3–4 day strength, definition and nutrition tracker.",
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
