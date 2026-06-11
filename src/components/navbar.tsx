"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
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
  const pathname = usePathname();

  function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`text-sm font-medium transition-colors ${
          active ? "text-white" : "text-white/50 hover:text-white/80"
        }`}
      >
        {children}
      </Link>
    );
  }

  const displayName = user?.displayName ?? user?.name;

  return (
    <nav style={{ backgroundColor: "#101418" }} className="sticky top-0 z-50 border-b border-white/8">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo + nav links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-tight">Juyo</span>
            <span className="text-white/30 text-sm">|</span>
            <span className="text-white/60 text-sm">WC2026</span>
          </Link>

          <div className="hidden sm:flex items-center gap-6">
            <NavLink href="/leaderboard">Leaderboard</NavLink>
            {user && (
              <>
                <NavLink href="/predict">Predict</NavLink>
                <NavLink href="/dashboard">My scores</NavLink>
              </>
            )}
          </div>
        </div>

        {/* Auth area */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/profile" className="flex items-center gap-2">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={displayName ?? "avatar"}
                    width={28}
                    height={28}
                    className="rounded-full opacity-90 hover:opacity-100 transition-opacity"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-medium">
                    {displayName?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-sm text-white/60 hover:text-white/90 transition-colors">
                  {displayName}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white hover:bg-white/10 border-0"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="accent"
              onClick={() => signIn("google", { callbackUrl: "/predict" })}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
