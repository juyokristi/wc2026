import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { fixGroupPairings } from "@/lib/fix-pairings";

export async function POST() {
  const session = await auth();
  if (
    !session?.user?.email ||
    session.user.email !== process.env.ADMIN_EMAIL
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await fixGroupPairings();
  return NextResponse.json(result);
}
