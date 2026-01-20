import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import sharp from "sharp";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        let { name, type, data, size } = body;

        if (!data || !name || !type) {
            return new NextResponse("Missing file data", { status: 400 });
        }

        // Limit server-side to prevent crash (e.g. 10MB)
        if (size > 10 * 1024 * 1024) {
            return new NextResponse("File too large (max 10MB)", { status: 413 });
        }

        // Convert HEIC/HEIF to JPEG
        if (type.includes("heic") || type.includes("heif") || name.toLowerCase().endsWith(".heic")) {
            try {
                const base64Data = data.split("base64,")[1] || data;
                const buffer = Buffer.from(base64Data, "base64");
                
                const jpegBuffer = await sharp(buffer)
                    .jpeg({ quality: 80 })
                    .toBuffer();
                
                data = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
                type = "image/jpeg";
                name = name.replace(/\.(heic|heif)$/i, ".jpg");
                size = jpegBuffer.length;
            } catch (conversionError) {
                console.error("HEIC conversion failed:", conversionError);
                // Fallback to original file if conversion fails
            }
        }

        const attachment = await prisma.chatAttachment.create({
            data: {
                name,
                type,
                data, // Storing base64 string
                size
            }
        });

        return NextResponse.json({ 
            url: `/api/file/${attachment.id}`,
            id: attachment.id 
        });

    } catch (error) {
        console.error("Upload error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
