import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import SignOutButton from '@/components/auth/SignOutButton'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Tracker",
  description: "Track job applications",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="flex items-center justify-between p-4 border-b">
          <Link href="/" className="font-semibold">
            Job Tracker
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/signin">Sign in</Link>
            <Link href="/signup">Sign up</Link>
            <SignOutButton />
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
