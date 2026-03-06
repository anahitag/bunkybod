import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";

export const dynamic = "force-dynamic";

export default async function FoodPage() {
  try {
    const profile = await prisma.userProfile.findFirst();
    if (!profile || !profile.onboarded) redirect("/onboarding");
    return <Dashboard userName={profile.name} />;
  } catch (e) {
    console.error("Food page error:", e);
    redirect("/onboarding");
  }
}
