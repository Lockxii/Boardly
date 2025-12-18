"use client";

import { ChevronLeft, Share2, Users, MoreHorizontal, Check, Mail, Pencil, Download, ImageIcon, ShieldAlert, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useOthers, useSelf } from "@/liveblocks.config";
import { useState, useRef, useEffect } from "react";
import { InviteDialog } from "./invite-dialog";
import { TeamDialog } from "./team-dialog";
import { HistoryDialog } from "./history-dialog";
import { useParams } from "next/navigation";
import { updateBoardTitle } from "@/app/board/actions";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
    title: string;
}

export function Navbar({ title }: NavbarProps) {
    const params = useParams();
    const boardId = params.boardId as string;
    
    const others = useOthers();
    const self = useSelf();
    const activeUsersCount = others.length + 1;
    
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [newTitle, setNewTitle] = useState(title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setNewTitle(title);
    }, [title]);

    const handleExport = (format: "png" | "jpeg") => {
        const svg = document.querySelector("svg");
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        canvas.width = svg.clientWidth;
        canvas.height = svg.clientHeight;
        img.onload = () => {
            if (!ctx) return;
            if (format === "jpeg") { ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL(`image/${format}`);
            const link = document.createElement("a");
            link.download = `${title || "board"}.${format}`;
            link.href = dataUrl;
            link.click();
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    };

    const onCopy = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const onSubmit = async () => {
        if (newTitle === title || !newTitle.trim()) { setIsEditing(false); setNewTitle(title); return; }
        setIsEditing(false);
        try { await updateBoardTitle(boardId, newTitle); } catch (error) { setNewTitle(title); }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") onSubmit();
        if (e.key === "Escape") { setIsEditing(false); setNewTitle(title); }
    };

    return (
        <nav className="absolute top-4 left-4 right-4 h-14 flex items-center bg-transparent backdrop-blur-sm rounded-xl border border-neutral-200/20 dark:border-neutral-700/20 px-4 pointer-events-auto z-20 transition-all">
            <div className="flex items-center gap-4 flex-1">
                <Button variant="ghost" size="icon" asChild className="h-9 w-9 hover:bg-white/20 dark:hover:bg-neutral-700/20">
                    <Link href="/dashboard"><ChevronLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400" /></Link>
                </Button>
                <div className="h-6 w-[1px] bg-neutral-300 dark:bg-neutral-600" />
                {isEditing ? (
                    <input ref={inputRef} autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onBlur={onSubmit} onKeyDown={onKeyDown} className="text-sm font-semibold bg-white/20 dark:bg-black/20 outline-none px-2 py-1 rounded border border-blue-500/50 dark:text-white" />
                ) : (
                    <div onClick={() => setIsEditing(true)} className="flex items-center gap-2 cursor-pointer hover:bg-white/10 dark:hover:bg-black/10 px-2 py-1 rounded transition group">
                        <h1 className="text-sm font-semibold truncate max-w-[200px] dark:text-white">{title}</h1>
                        <Pencil className="h-3 w-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                )}
            </div>

            <div className="hidden lg:flex items-center bg-white/10 dark:bg-black/10 px-3 py-1.5 rounded-full gap-3 mr-4 border border-neutral-200/20 dark:border-neutral-700/20">
                <div className="flex -space-x-2 overflow-hidden">
                    {others.slice(0, 3).map(({ connectionId, info }) => (
                        <div key={connectionId} className="inline-block h-6 w-6 rounded-full ring-2 ring-white/50 dark:ring-neutral-800/50 bg-neutral-200 dark:bg-neutral-700 overflow-hidden" title={info?.name}>
                            {info?.picture ? <img src={info.picture} alt={info.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-neutral-500">{info?.name?.[0]}</div>}
                        </div>
                    ))}
                    {self && (
                        <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white/50 dark:ring-neutral-800/50 bg-blue-100 dark:bg-blue-900 overflow-hidden" title={`${self.info?.name} (Vous)`}>
                            {self.info?.picture ? <img src={self.info.picture} alt={self.info.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-300">{self.info?.name?.[0]}</div>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-200">{activeUsersCount} {activeUsersCount > 1 ? "actifs" : "seul"}</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <HistoryDialog />
                <TeamDialog boardId={boardId} />
                <InviteDialog />
                <Button variant="outline" size="sm" className={`h-9 gap-2 transition-all duration-300 ${copied ? "bg-green-500 text-white border-green-500 hover:bg-green-600 hover:text-white" : "bg-white/10 text-blue-600 border-blue-200/50 hover:bg-white/20 dark:border-blue-800/50 dark:text-blue-400"}`} onClick={onCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    <span className="hidden sm:inline">{copied ? "Copié !" : "Lien"}</span>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20 dark:hover:bg-neutral-700/20"><MoreHorizontal className="h-5 w-5 text-neutral-600 dark:text-neutral-400" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Exporter</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleExport("png")} className="gap-2 cursor-pointer"><ImageIcon className="h-4 w-4" /> PNG</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport("jpeg")} className="gap-2 cursor-pointer"><Download className="h-4 w-4" /> JPEG</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 dark:text-red-400 gap-2 cursor-pointer"><ShieldAlert className="h-4 w-4" /> Signaler un abus</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </nav>
    );
}