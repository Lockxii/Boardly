"use client";

import { ChevronLeft, Share2, Users, MoreHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useOthers } from "@/liveblocks.config";
import { useState } from "react";

interface NavbarProps {
    title: string;
}

export function Navbar({ title }: NavbarProps) {
    const others = useOthers();
    const activeUsersCount = others.length + 1;
    const [copied, setCopied] = useState(false);

    const onCopy = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <nav className="absolute top-4 left-4 right-4 h-14 flex items-center bg-transparent backdrop-blur-sm rounded-xl border border-neutral-200/20 dark:border-neutral-700/20 px-4 pointer-events-auto z-20 transition-all">
            {/* Left Section: Back & Title */}
            <div className="flex items-center gap-4 flex-1">
                <Button variant="ghost" size="icon" asChild className="h-9 w-9 hover:bg-white/20 dark:hover:bg-neutral-700/20">
                    <Link href="/dashboard">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="h-6 w-[1px] bg-neutral-300 dark:bg-neutral-600" />
                <h1 className="text-sm font-semibold truncate max-w-[200px] dark:text-white">
                    {title}
                </h1>
            </div>

            {/* Middle Section: Active Users (Presence) */}
            <div className="hidden md:flex items-center bg-white/30 dark:bg-black/20 px-3 py-1.5 rounded-full gap-2 mr-4 border border-neutral-200/30 dark:border-neutral-700/30">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                    {activeUsersCount} {activeUsersCount > 1 ? "actifs" : "seul"}
                </span>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    className={`h-9 gap-2 transition-all duration-300 ${
                        copied 
                        ? "bg-green-500 text-white border-green-500 hover:bg-green-600 hover:text-white" 
                        : "bg-white/50 text-blue-600 border-blue-200 hover:bg-blue-50 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                    }`}
                    onClick={onCopy}
                >
                    {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    <span className="hidden sm:inline">
                        {copied ? "Copié !" : "Inviter"}
                    </span>
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20 dark:hover:bg-neutral-700/20">
                    <MoreHorizontal className="h-5 w-5" />
                </Button>
            </div>
        </nav>
    );
}
