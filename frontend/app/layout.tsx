import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Altolend — AI-Powered Loan Approval",
  description:
    "Apply for a loan in minutes. Fast, fair, AI-powered decisions you can trust.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
