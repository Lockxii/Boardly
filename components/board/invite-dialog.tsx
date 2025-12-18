"use client";

import { useState } from "react";
import { Mail, Send, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { inviteUserByEmail } from "@/app/board/actions";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteDialog() {
    const params = useParams();
    const boardId = params.boardId as string;
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const onInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setError("");
        
        try {
            const result = await inviteUserByEmail(boardId, email);
            if (result.error) {
                setError(result.error);
            } else {
                setSent(true);
                setEmail("");
                setTimeout(() => setSent(false), 3000);
            }
        } catch (err) {
            setError("Une erreur est survenue");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/20">
                    <Mail className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Inviter un collaborateur</DialogTitle>
                    <DialogDescription>
                        Envoyez une invitation par e-mail pour rejoindre ce tableau et collaborer en temps réel.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onInvite} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="exemple@domaine.com"
                            className="col-span-3"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    {sent && (
                        <p className="text-sm text-green-600 font-medium text-center">
                            Invitation envoyée avec succès !
                        </p>
                    )}
                    {error && (
                        <p className="text-sm text-red-600 font-medium text-center">
                            {error}
                        </p>
                    )}
                </form>
                <DialogFooter>
                    <Button 
                        type="submit" 
                        onClick={onInvite} 
                        disabled={isLoading || !email}
                        className="w-full sm:w-auto gap-2"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                        Inviter
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
