import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/predict");

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-6"
      style={{
        background: "radial-gradient(240px 180px at 50% 100%, rgba(150, 133, 228, 0.18) 0%, rgba(150, 133, 228, 0.06) 50%, transparent 85%), #0B0F14",
      }}
    >
      <div className="max-w-lg text-center space-y-8">
        {/* WC2026 logo */}
        <div
          className="mx-auto inline-flex items-center justify-center rounded-2xl"
          style={{ backgroundColor: "#FFFFFF", padding: "14px 22px" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wc2026-logo.svg"
            alt="FIFA World Cup 2026"
            style={{ height: "80px", width: "auto", display: "block" }}
          />
        </div>

        {/* Eyebrow */}
        <p
          className="text-xs font-bold uppercase tracking-[2px]"
          style={{ color: "#9685E4" }}
        >
          Juyo internal · WC2026
        </p>

        {/* Headline */}
        <div className="space-y-4">
          <h1
            className="text-5xl font-bold leading-tight"
            style={{ color: "#FAFAFA", letterSpacing: "-0.8px" }}
          >
            Predict every match.<br />Top the table.
          </h1>
          <p className="text-lg" style={{ color: "#8A9199", lineHeight: "1.7" }}>
            Pick the score for all 104 World Cup 2026 matches.
            Earn points for the result, the margin, and the exact score.
          </p>
        </div>

        {/* Scoring rules */}
        <div
          className="rounded-2xl p-5 space-y-2 text-left"
          style={{ backgroundColor: "#161B22", border: "1px solid #252B34" }}
        >
          <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{ color: "#9685E4" }}>
            How points work
          </p>
          <div className="flex items-center justify-between text-sm" style={{ color: "#FAFAFA" }}>
            <span>Exact score</span>
            <span className="font-semibold" style={{ color: "#9685E4" }}>5 pts</span>
          </div>
          <div className="h-px" style={{ backgroundColor: "#252B34" }} />
          <div className="flex items-center justify-between text-sm" style={{ color: "#FAFAFA" }}>
            <span>Correct result + same goal margin</span>
            <span className="font-semibold" style={{ color: "#9685E4" }}>4 pts</span>
          </div>
          <div className="h-px" style={{ backgroundColor: "#252B34" }} />
          <div className="flex items-center justify-between text-sm" style={{ color: "#FAFAFA" }}>
            <span>Correct result only</span>
            <span className="font-semibold" style={{ color: "#9685E4" }}>3 pts</span>
          </div>
        </div>

        {/* CTA */}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/predict" });
          }}
          className="w-full"
        >
          <Button type="submit" size="lg" variant="accent" className="w-full">
            Sign in with Google
          </Button>
        </form>

        <p className="text-xs" style={{ color: "#8A9199" }}>
          Use your Juyo Google account to sign in.
        </p>
      </div>
    </div>
  );
}
