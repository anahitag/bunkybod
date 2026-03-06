import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function main() {
  const existingUser = await prisma.userProfile.findFirst();
  if (existingUser) {
    console.log("User already exists, skipping seed.");
    return;
  }

  await prisma.userProfile.create({
    data: {
      name: "User",
      calorieTarget: 2000,
      proteinTargetG: 150,
      carbTargetG: 250,
      fatTargetG: 65,
      fiberTargetG: 30,
      goalType: "maintain",
      onboarded: false,
    },
  });

  console.log("Seeded default user profile.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
