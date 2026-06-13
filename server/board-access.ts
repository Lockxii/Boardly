import { prisma } from "./prisma.js";

export type BoardAccess = {
  board: NonNullable<Awaited<ReturnType<typeof prisma.board.findUnique>>>;
  role: "owner" | "editor";
  isOwner: boolean;
};

export async function getBoardAccess(
  boardId: string,
  user: { id: string; email: string }
): Promise<BoardAccess | null> {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return null;
  if (board.authorId === user.id) {
    return { board, role: "owner", isOwner: true };
  }
  const member = await prisma.boardMember.findFirst({
    where: { boardId, email: user.email },
  });
  if (!member) return null;
  return { board, role: "editor", isOwner: false };
}
