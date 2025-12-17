"use client";

import { deleteBoard } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function BoardDeleteButton({ boardId }: { boardId: string }) {
    return (
        <form action={deleteBoard} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <input type="hidden" name="boardId" value={boardId} />
            <Button 
                type="submit" 
                variant="destructive" 
                size="icon" 
                className="h-8 w-8 rounded-full shadow-sm"
                onClick={(e) => e.stopPropagation()} // Safe here in Client Component
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </form>
    );
}
