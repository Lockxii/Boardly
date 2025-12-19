"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface CommentComposerProps {
    onSubmit: (text: string) => void;
    onCancel?: () => void;
}

export function CommentComposer({ onSubmit, onCancel }: CommentComposerProps) {
    const [text, setText] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSubmit(text);
        setText("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
        if (e.key === "Escape" && onCancel) {
            onCancel();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-800 p-2 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-64">
            <textarea
                className="w-full bg-transparent resize-none outline-none text-sm p-1 min-h-[60px] dark:text-white"
                placeholder="Écrivez un commentaire..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
                {onCancel && (
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
                        Annuler
                    </Button>
                )}
                <Button type="submit" size="sm" className="h-7 w-7 p-0 rounded-full" disabled={!text.trim()}>
                    <Send className="h-3 w-3" />
                </Button>
            </div>
        </form>
    );
}
