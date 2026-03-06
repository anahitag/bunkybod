import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { CoachDashboard } from "@/components/coach/coach-dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await prisma.userProfile.findFirst();
  if (!profile || !profile.onboarded) redirect("/onboarding");
  return <CoachDashboard userName={profile.name} />;
}
