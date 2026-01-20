import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ fileId: string }> }
) {
    try {
        const { fileId } = await params;
        
        const attachment = await prisma.chatAttachment.findUnique({
            where: { id: fileId }
        });

        if (!attachment) {
            return new NextResponse("Not Found", { status: 404 });
        }

        // Convert base64 data back to buffer
        // Data is stored as "data:image/png;base64,..." or just base64?
        // The client usually sends DataURL. We need to strip the prefix if we want raw buffer,
        // or just serve it.
        // If we store DataURL directly in `data`, we can't just pipe it as binary easily without parsing.
        // Simpler: Serve it as is? No, `img src` works with DataURL but downloading a file needs a blob.
        // Let's assume we want to serve it as a standard file stream.
        
        const fileData = attachment.data;
        let buffer: Buffer;

        if (fileData.includes("base64,")) {
            const base64 = fileData.split("base64,")[1];
            buffer = Buffer.from(base64, "base64");
        } else {
            buffer = Buffer.from(fileData, "base64");
        }

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": attachment.type,
                "Content-Disposition": `inline; filename="${attachment.name}"`,
                "Content-Length": buffer.length.toString()
            }
        });

    } catch (error) {
        console.error("File serve error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
