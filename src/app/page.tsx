import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/predict");

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <div className="max-w-lg text-center space-y-6">
        <div className="text-6xl">⚽</div>
        <h1 className="text-4xl font-bold tracking-tight">WC2026 Predictor</h1>
        <p className="text-muted-foreground text-lg">
          Predict scores for all 104 World Cup 2026 matches. Earn points for
          correct results, margins, and exact scores. Climb the leaderboard.
        </p>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>🎯 <strong>5 pts</strong> — exact score</p>
          <p>🔥 <strong>4 pts</strong> — correct result + same goal margin</p>
          <p>✅ <strong>3 pts</strong> — correct result only</p>
        </div>
        <a href="/api/auth/signin/google?callbackUrl=%2Fpredict" className="w-full max-w-xs">
          <Button size="lg" className="w-full">
            Sign in with Google
          </Button>
        </a>
      </div>
    </div>
  );
}
