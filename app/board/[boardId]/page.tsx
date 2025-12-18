import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Room } from "@/components/room";

interface BoardPageProps {
    params: Promise<{
        boardId: string;
    }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
    const { boardId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session) {
        redirect("/auth/sign-in");
    }

    const board = await prisma.board.findUnique({
        where: { id: boardId }
    });

    if (!board) {
        notFound();
    }

    // Security: Only author or members can access
    const isAuthor = board.authorId === session.user.id;
    
    // Debug: Check what's available in prisma
    console.log("Prisma models available:", Object.keys(prisma).filter(k => !k.startsWith('_')));

    // Check membership safely
    let isMember = false;
    const boardMemberModel = (prisma as any).boardMember;
    
    if (boardMemberModel) {
        const member = await boardMemberModel.findFirst({
            where: {
                boardId: boardId,
                email: session.user.email as string
            }
        });
        isMember = !!member;
    } else {
        console.warn("prisma.boardMember is NOT available at runtime.");
    }

    if (!isAuthor && !isMember) {
        redirect("/dashboard");
    }

    return (
        <Room roomId={board.id} template={board.template || "blank"} title={board.title} />
    );
}
