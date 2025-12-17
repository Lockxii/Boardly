"use server"
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createBoard(formData: FormData) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        redirect("/auth/sign-in");
    }
    
    const title = formData.get("title") as string || "Untitled Board";
    const template = formData.get("template") as string || "blank";
    
    const board = await prisma.board.create({
        data: {
            title,
            template,
            authorId: session.user.id
        }
    });
    
    revalidatePath("/dashboard");
    redirect(`/board/${board.id}`);
}

export async function deleteBoard(formData: FormData) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return;

    const boardId = formData.get("boardId") as string;
    
    // Verify author ownership
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board || board.authorId !== session.user.id) return;

    await prisma.board.delete({
        where: { id: boardId }
    });

    revalidatePath("/dashboard");
}
