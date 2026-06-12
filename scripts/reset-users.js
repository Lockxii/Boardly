/**
 * Reset all users and related auth/board data.
 * Usage: node scripts/reset-users.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = {
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    sessions: await prisma.session.count(),
    boards: await prisma.board.count(),
  };

  await prisma.$transaction([
    prisma.boardMember.deleteMany(),
    prisma.board.deleteMany(),
    prisma.chatAttachment.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const after = {
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    sessions: await prisma.session.count(),
    boards: await prisma.board.count(),
  };

  console.log("Reset complete.");
  console.log({ before, after });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
