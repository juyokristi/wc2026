"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    displayName?: string | null;
  } | null;
  isAdmin?: boolean;
  openCount?: number;
}

export function Navbar({ user, isAdmin, openCount }: NavbarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

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
                <NavLink href="/predict">
                  Predict
                  {(openCount ?? 0) > 0 && (
                    <span
                      className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(150,133,228,0.25)", color: "#9685E4" }}
                    >
                      {openCount}
                    </span>
                  )}
                </NavLink>
                <NavLink href="/dashboard">My scores</NavLink>
                {isAdmin && <NavLink href="/admin">Admin</NavLink>}
              </>
            )}
          </div>
        </div>

        {/* Auth area */}
        <div className="flex items-center gap-3">
          <button
            className="text-white/50 hover:text-white/80 transition-colors p-1"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
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
