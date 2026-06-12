import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WC2026 Predictor — Juyo",
  description: "Predict World Cup 2026 scores and compete on the leaderboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isAdmin =
    !!session?.user?.email &&
    session.user.email === process.env.ADMIN_EMAIL;

  const openCount = session?.user?.id
    ? await prisma.match.count({
        where: {
          status: "SCHEDULED",
          kickoff: { gt: new Date() },
          predictions: { none: { userId: session.user.id } },
        },
      })
    : 0;

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <Navbar user={session?.user ?? null} isAdmin={isAdmin} openCount={openCount} />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
