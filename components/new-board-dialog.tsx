"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Layout } from "lucide-react";
import { createBoard } from "@/app/dashboard/actions";
import { cn } from "@/lib/utils";

export function NewBoardDialog() {
    const [selectedTemplate, setSelectedTemplate] = useState("blank");
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau Tableau
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <form action={createBoard}>
                    <DialogHeader>
                        <DialogTitle>Créer un tableau</DialogTitle>
                        <DialogDescription>Choisissez un modèle pour commencer.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Titre du tableau</Label>
                            <Input id="title" name="title" placeholder="Mon super projet" required />
                        </div>

                        <div className="space-y-2">
                            <Label>Modèle</Label>
                            <input type="hidden" name="template" value={selectedTemplate} />
                            
                            <div className="grid grid-cols-3 gap-4">
                                {/* Blank Template */}
                                <div 
                                    className={cn(
                                        "cursor-pointer rounded-lg border-2 p-1 transition-all hover:border-blue-500",
                                        selectedTemplate === "blank" ? "border-blue-600 bg-blue-50" : "border-muted"
                                    )}
                                    onClick={() => setSelectedTemplate("blank")}
                                >
                                    <div className="aspect-video w-full rounded-md bg-white border border-neutral-200 shadow-sm mb-2" />
                                    <div className="text-center text-sm font-medium">Vide</div>
                                </div>

                                {/* Grid Template */}
                                <div 
                                    className={cn(
                                        "cursor-pointer rounded-lg border-2 p-1 transition-all hover:border-blue-500",
                                        selectedTemplate === "grid" ? "border-blue-600 bg-blue-50" : "border-muted"
                                    )}
                                    onClick={() => setSelectedTemplate("grid")}
                                >
                                    <div className="aspect-video w-full rounded-md bg-white border border-neutral-200 shadow-sm mb-2 overflow-hidden relative">
                                         <div className="absolute inset-0" 
                                              style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '10px 10px' }} 
                                         />
                                    </div>
                                    <div className="text-center text-sm font-medium">Grille</div>
                                </div>

                                {/* Blueprint Template */}
                                <div 
                                    className={cn(
                                        "cursor-pointer rounded-lg border-2 p-1 transition-all hover:border-blue-500",
                                        selectedTemplate === "blueprint" ? "border-blue-600 bg-blue-50" : "border-muted"
                                    )}
                                    onClick={() => setSelectedTemplate("blueprint")}
                                >
                                    <div className="aspect-video w-full rounded-md bg-[#1e40af] border border-blue-900 shadow-sm mb-2 overflow-hidden relative">
                                        <div className="absolute inset-0" 
                                              style={{ 
                                                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', 
                                                backgroundSize: '20px 20px' 
                                              }} 
                                         />
                                    </div>
                                    <div className="text-center text-sm font-medium">Plan</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit">Créer</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
