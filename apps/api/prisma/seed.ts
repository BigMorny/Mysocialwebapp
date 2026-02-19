import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    where: { id: "basic" },
    update: {},
    create: {
      id: "basic",
      name: "Basic",
      maxLoginDevices: 1,
      exportCsv: false,
      staffAccounts: false,
      auditLog: false,
      advancedReports: false,
    },
  });

  await prisma.plan.upsert({
    where: { id: "standard" },
    update: {},
    create: {
      id: "standard",
      name: "Standard",
      maxLoginDevices: 2,
      exportCsv: true,
      staffAccounts: true,
      auditLog: false,
      advancedReports: false,
    },
  });

  await prisma.plan.upsert({
    where: { id: "premium" },
    update: {},
    create: {
      id: "premium",
      name: "Premium",
      maxLoginDevices: 3,
      exportCsv: true,
      staffAccounts: true,
      auditLog: true,
      advancedReports: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


