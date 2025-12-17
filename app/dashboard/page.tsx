import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createBoard } from "./actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Layout, Clock } from "lucide-react";
import { NewBoardDialog } from "@/components/new-board-dialog";
import { BoardDeleteButton } from "@/components/board-delete-button";

export default async function Dashboard() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/auth/sign-in");

    const boards = await prisma.board.findMany({
        where: { authorId: session.user.id },
        orderBy: { updatedAt: 'desc' }
    });

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
            <header className="flex justify-between items-center mb-12 max-w-6xl mx-auto">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Layout className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
                        Mes Tableaux
                    </h1>
                </div>
                <div className="flex items-center gap-6">
                     <span className="text-sm text-neutral-500 font-medium">
                        {session.user.name || session.user.email}
                     </span>
                     <NewBoardDialog />
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {boards.map(board => (
                    <Link href={`/board/${board.id}`} key={board.id} className="block group relative">
                        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 h-56 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 bg-white dark:bg-neutral-900 flex flex-col justify-between cursor-pointer overflow-hidden">
                            
                            {/* Decorative gradient based on template */}
                            <div className={`absolute top-0 left-0 w-full h-1.5 ${
                                board.template === 'blueprint' ? 'bg-blue-600' : 
                                board.template === 'grid' ? 'bg-neutral-400' : 'bg-orange-400'
                            }`} />

                            <div>
                                <h3 className="font-semibold text-lg text-neutral-800 dark:text-neutral-100 group-hover:text-blue-600 transition truncate pr-8">
                                    {board.title}
                                </h3>
                                <p className="text-xs text-neutral-500 mt-1 capitalize">Modèle {board.template}</p>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <span className="text-xs text-neutral-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(board.updatedAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* Delete Button */}
                        <BoardDeleteButton boardId={board.id} />
                    </Link>
                ))}
                
                {/* Empty State */}
                {boards.length === 0 && (
                     <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50">
                        <div className="h-16 w-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                            <Layout className="h-8 w-8 text-neutral-400" />
                        </div>
                        <h3 className="text-lg font-medium text-neutral-900">Aucun tableau pour le moment</h3>
                        <p className="text-neutral-500 max-w-sm mt-2 mb-6">Créez votre premier tableau pour commencer à visualiser vos idées.</p>
                        <NewBoardDialog />
                     </div>
                )}
            </div>
        </div>
    )
}
