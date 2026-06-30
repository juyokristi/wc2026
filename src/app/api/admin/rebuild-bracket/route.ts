import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rebuildBracket } from "@/lib/bracket";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await rebuildBracket();
  return NextResponse.json(result);
}
