import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, displayName: true, image: true, email: true, createdAt: true },
  });

  if (!user) redirect("/");

  const displayName = user.displayName ?? user.name ?? "";

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-2" style={{ color: "#9685E4" }}>
          Account
        </p>
        <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.5px", color: "#101418" }}>
          Your Profile
        </h1>
      </div>

      <div
        className="rounded-2xl p-6 space-y-6"
        style={{ border: "1px solid #E4E6EA", backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user.image ?? undefined} alt={displayName} />
            <AvatarFallback
              className="text-lg font-semibold"
              style={{ backgroundColor: "rgba(150,133,228,0.12)", color: "#9685E4" }}
            >
              {displayName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold" style={{ color: "#101418" }}>{user.name}</p>
            <p className="text-sm" style={{ color: "#8A9199" }}>{user.email}</p>
          </div>
        </div>

        <div className="h-px" style={{ backgroundColor: "#E4E6EA" }} />

        <ProfileForm currentDisplayName={displayName} />
      </div>
    </div>
  );
}
