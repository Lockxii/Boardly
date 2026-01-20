"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, User, Lock, Trash2, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface SettingsDialogProps {
    user: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
    };
}

export function SettingsDialog({ user }: SettingsDialogProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"profile" | "account" | "danger">("profile");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

    // Profile State
    const [name, setName] = useState(user.name);
    
    // Email State
    const [email, setEmail] = useState(user.email);
    
    // Password State
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleUpdateProfile = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            await authClient.updateUser({ name });
            setMessage({ type: "success", text: "Profil mis à jour avec succès." });
            router.refresh();
        } catch (error) {
            setMessage({ type: "error", text: "Erreur lors de la mise à jour." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateEmail = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            await authClient.changeEmail({ newEmail: email, callbackURL: "/dashboard" });
            setMessage({ type: "success", text: "Email mis à jour. Veuillez vérifier votre nouvelle adresse." });
        } catch (error) {
             setMessage({ type: "error", text: "Erreur lors du changement d'email." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", text: "Les mots de passe ne correspondent pas." });
            return;
        }
        setIsLoading(true);
        setMessage(null);
        try {
            await authClient.changePassword({ newPassword, currentPassword, revokeOtherSessions: true });
            setMessage({ type: "success", text: "Mot de passe modifié avec succès." });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error) {
            setMessage({ type: "error", text: "Erreur lors du changement de mot de passe. Vérifiez votre mot de passe actuel." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.")) return;
        setIsLoading(true);
        try {
            await authClient.deleteUser();
            router.push("/");
        } catch (error) {
            setMessage({ type: "error", text: "Erreur lors de la suppression du compte." });
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <div className="flex h-[450px]">
                    {/* Sidebar */}
                    <div className="w-[200px] bg-neutral-50 dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-2">
                        <div className="font-semibold text-lg px-2 mb-4">Réglages</div>
                        <Button variant={activeTab === "profile" ? "secondary" : "ghost"} className="justify-start gap-2" onClick={() => { setActiveTab("profile"); setMessage(null); }}>
                            <User className="h-4 w-4" /> Profil
                        </Button>
                        <Button variant={activeTab === "account" ? "secondary" : "ghost"} className="justify-start gap-2" onClick={() => { setActiveTab("account"); setMessage(null); }}>
                            <Lock className="h-4 w-4" /> Sécurité
                        </Button>
                        <Button variant={activeTab === "danger" ? "secondary" : "ghost"} className="justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setActiveTab("danger"); setMessage(null); }}>
                            <Trash2 className="h-4 w-4" /> Danger
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <DialogHeader className="mb-6">
                            <DialogTitle>
                                {activeTab === "profile" && "Mon Profil"}
                                {activeTab === "account" && "Sécurité"}
                                {activeTab === "danger" && "Zone Danger"}
                            </DialogTitle>
                            <DialogDescription>
                                {activeTab === "profile" && "Gérez vos informations personnelles."}
                                {activeTab === "account" && "Mettez à jour votre mot de passe et vos accès."}
                                {activeTab === "danger" && "Suppression définitive du compte."}
                            </DialogDescription>
                        </DialogHeader>

                        {message && (
                            <div className={`p-3 rounded-md mb-4 text-sm ${message.type === "success" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                                {message.text}
                            </div>
                        )}

                        {activeTab === "profile" && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nom d'affichage</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" />
                                    <p className="text-xs text-neutral-500">Changer votre email nécessitera une nouvelle vérification.</p>
                                </div>
                                <div className="flex justify-end gap-2 mt-6">
                                    <Button onClick={() => { 
                                        let p1 = Promise.resolve();
                                        let p2 = Promise.resolve();
                                        if(email !== user.email) p1 = handleUpdateEmail(); 
                                        if(name !== user.name) p2 = handleUpdateProfile(); 
                                        Promise.all([p1, p2]);
                                    }} disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enregistrer
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeTab === "account" && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Mot de passe actuel</Label>
                                    <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nouveau mot de passe</Label>
                                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirmer le nouveau mot de passe</Label>
                                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                </div>
                                <div className="flex justify-end mt-6">
                                    <Button onClick={handleUpdatePassword} disabled={isLoading || !currentPassword || !newPassword}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Mettre à jour
                                    </Button>
                                </div>
                            </div>
                        )}

                         {activeTab === "danger" && (
                            <div className="space-y-4">
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 p-4 rounded-lg">
                                    <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">Supprimer le compte</h4>
                                    <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                                        Une fois votre compte supprimé, toutes vos données (tableaux, historique, profil) seront définitivement effacées. Cette action est irréversible.
                                    </p>
                                    <Button variant="destructive" onClick={handleDeleteAccount} disabled={isLoading} className="w-full sm:w-auto">
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Supprimer mon compte définitivement
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
