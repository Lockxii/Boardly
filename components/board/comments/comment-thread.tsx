"use client";

import { useStorage } from "@/liveblocks.config";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageCircle, User } from "lucide-react";
import { useState } from "react";

// Liveblocks Thread type is complex, using 'any' for the custom UI prop for flexibility 
// but in a real app we would import the specific BaseThread type.
export function CommentThread({ thread }: { thread: any }) {
    const [isOpen, setIsOpen] = useState(false);

    // Get the first comment (body)
    const firstComment = thread.comments[0];
    if (!firstComment) return null;

    // Use metadata for position
    const { x, y } = thread.metadata;

    return (
        <div
            className="absolute"
            style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)", // Center pin on coords
                pointerEvents: "auto",
                zIndex: 50
            }}
        >
            {/* Pin Marker */}
            <div 
                className={`relative group cursor-pointer transition-all hover:scale-110 ${isOpen ? "z-50" : "z-10"}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 border-white shadow-md transition-colors ${isOpen ? "bg-blue-500 text-white" : "bg-white text-blue-500 hover:bg-blue-50"}`}>
                    <MessageCircle className="h-4 w-4 fill-current" />
                </div>
                
                {/* User Avatar Badge */}
                {/* We could fetch user info here using useUser(firstComment.userId) if configured */}
            </div>

            {/* Thread Content Popup */}
            {isOpen && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-64 overflow-hidden z-50 flex flex-col">
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-3 space-y-3">
                        {thread.comments.map((comment: any) => (
                            <div key={comment.id} className="flex gap-2 items-start">
                                <div className="h-6 w-6 rounded-full bg-neutral-200 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                                    <User className="h-3 w-3" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-xs font-bold truncate dark:text-neutral-200">Utilisateur</span>
                                        <span className="text-[10px] text-neutral-400">
                                            {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr }) : ""}
                                        </span>
                                    </div>
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300 break-words mt-0.5">
                                        {/* Liveblocks uses a structured body, we need to parse it or just display raw text if simple */}
                                        {comment.body?.content?.[0]?.children?.[0]?.text || "..."}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Here we could add a Reply composer */}
                </div>
            )}
        </div>
    );
}
