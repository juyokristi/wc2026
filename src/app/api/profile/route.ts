import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { displayName } = body;

  if (typeof displayName !== "string" || displayName.trim().length === 0) {
    return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { displayName: displayName.trim().slice(0, 50) },
    select: { id: true, displayName: true },
  });

  return NextResponse.json(user);
}
