"use server"
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { Resend } from "resend";

const resend = new Resend("re_D3njyAtv_NDwb7hdR2ZgG6CNhu85gzRaR");

export async function updateBoardTitle(boardId: string, title: string) {
    // ... (existant)
}

export async function inviteUserByEmail(boardId: string, email: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Non autorisé" };

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return { error: "Tableau introuvable" };

    // 1. Create member in DB
    try {
        await prisma.boardMember.upsert({
            where: {
                boardId_email: {
                    boardId,
                    email
                }
            },
            update: {},
            create: {
                boardId,
                email,
                role: "editor"
            }
        });
    } catch (e) {
        return { error: "Erreur lors de l'ajout du membre" };
    }

    // 2. Send Email via Resend
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/board/${boardId}`;
    const senderName = session.user.name || session.user.email;
    const senderImage = session.user.image;

    try {
        const data = await resend.emails.send({
            from: "Boardly <onboarding@resend.dev>",
            to: email,
            subject: `${senderName} vous invite sur le board '${board.title}'`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <div style="margin-bottom: 20px;">
                        <span style="font-size: 16px; font-weight: 600;">${senderName}</span>
                    </div>
                    <h2 style="color: #111827; margin-bottom: 16px;">Invitation à collaborer</h2>
                    <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
                        ${session.user.email} vous invite pour rejoindre le board <strong>'${board.title}'</strong>.
                    </p>
                    <div style="margin-top: 32px;">
                        <a href="${inviteLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
                            Rejoindre le tableau
                        </a>
                    </div>
                    <hr style="margin-top: 40px; border: 0; border-top: 1px solid #e5e7eb;" />
                    <p style="color: #9ca3af; font-size: 12px;">
                        Ceci est une invitation automatique de Boardly. Si vous n'attendiez pas cet e-mail, vous pouvez l'ignorer.
                    </p>
                </div>
            `
        });

        if (data.error) {
            console.error("Resend Error Detail:", data.error);
            return { error: `Resend: ${data.error.message}` };
        }

        console.log("Email sent successfully:", data.data?.id);
        return { success: true };
    } catch (error: any) {
        console.error("Critical Resend Error:", error);
        return { error: error.message || "Erreur lors de l'envoi de l'email" };
    }
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


