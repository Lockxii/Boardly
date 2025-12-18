"use server"
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function updateBoardTitle(boardId: string, title: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Non autorisé" };

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board || board.authorId !== session.user.id) return { error: "Non autorisé" };

    await prisma.board.update({
        where: { id: boardId },
        data: { title }
    });

    revalidatePath(`/board/${boardId}`);
    revalidatePath("/dashboard");
    
    return { success: true };
}

export async function getBoardMembers(boardId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return [];

    const members = await prisma.boardMember.findMany({
        where: { boardId }
    });

    return members;
}

export async function removeBoardMember(boardId: string, email: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Non autorisé" };

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board || board.authorId !== session.user.id) return { error: "Seul le créateur peut bannir des membres" };

    await prisma.boardMember.delete({
        where: {
            boardId_email: {
                boardId,
                email
            }
        }
    });

    revalidatePath(`/board/${boardId}`);
    return { success: true };
}

