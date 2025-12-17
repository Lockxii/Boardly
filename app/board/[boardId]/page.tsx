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

    return (
        <Room roomId={board.id} template={board.template || "blank"} />
    );
}
