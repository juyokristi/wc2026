import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config — no Prisma/PG imports. Used only by middleware.
export const authConfig: NextAuthConfig = {
  providers: [Google],
  session: { strategy: "database" },
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isProtected =
        path.startsWith("/dashboard") ||
        path.startsWith("/predict") ||
        path.startsWith("/profile");

      if (isProtected && !isLoggedIn) return false;
      return true;
    },
  },
};
