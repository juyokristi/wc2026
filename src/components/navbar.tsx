"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    displayName?: string | null;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  return (
    <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg tracking-tight">
            ⚽ WC2026
          </Link>
          {user && (
            <>
              <Link href="/predict" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Predict
              </Link>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
            </>
          )}
          <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Leaderboard
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/profile" className="flex items-center gap-2 text-sm">
                {user.image && (
                  <Image
                    src={user.image}
                    alt={user.name ?? "avatar"}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                )}
                <span className="hidden sm:inline text-muted-foreground hover:text-foreground transition-colors">
                  {user.displayName ?? user.name}
                </span>
              </Link>
              <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </Button>
            </>
          ) : (
            <a href="/api/auth/signin/google?callbackUrl=%2Fpredict">
              <Button size="sm">Sign in with Google</Button>
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
