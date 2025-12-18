"use client";

import { ChevronLeft, Share2, Users, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useOthers } from "@/liveblocks.config";

interface NavbarProps {
    title: string;
}

export function Navbar({ title }: NavbarProps) {
    const others = useOthers();
    const activeUsersCount = others.length + 1; // +1 for self

    return (
        <nav className="absolute top-4 left-4 right-4 h-14 flex items-center bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 px-4 pointer-events-auto z-20">
            {/* Left Section: Back & Title */}
            <div className="flex items-center gap-4 flex-1">
                <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                    <Link href="/dashboard">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="h-6 w-[1px] bg-neutral-200 dark:bg-neutral-700" />
                <h1 className="text-sm font-semibold truncate max-w-[200px] dark:text-white">
                    {title}
                </h1>
            </div>

            {/* Middle Section: Active Users (Presence) */}
            <div className="hidden md:flex items-center bg-neutral-100 dark:bg-neutral-900 px-3 py-1.5 rounded-full gap-2 mr-4 border border-neutral-200 dark:border-neutral-700">
                <Users className="h-3.5 w-3.5 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    {activeUsersCount} {activeUsersCount > 1 ? "personnes actives" : "seul sur le board"}
                </span>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400"
                    onClick={() => {
                        // For now, copy URL to clipboard
                        navigator.clipboard.writeText(window.location.href);
                        alert("Lien d'invitation copié !");
                    }}
                >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Inviter</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-5 w-5" />
                </Button>
            </div>
        </nav>
    );
}
