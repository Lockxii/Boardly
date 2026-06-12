import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { authClient, fetchCurrentUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { BoardlyBrand } from "@/components/boardly-brand";
import { Plus, Layout, Clock, Trash2, Settings, User, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Board, User as UserType } from "@/lib/types";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user } = useQuery<UserType | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
  });

  const { data: boards = [], isLoading } = useQuery<Board[]>({
    queryKey: ["boards"],
    queryFn: () => apiFetch<Board[]>("/api/boards"),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; template: string }) =>
      apiFetch<Board>("/api/boards", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      navigate({ to: `/board/$boardId`, params: { boardId: board.id } });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/boards/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boards"] }),
  });

  const [searchQuery, setSearchQuery] = useState("");

  const [darkMode, setDarkMode] = useState(typeof window !== "undefined" && document.documentElement.classList.contains("dark"));

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("boardly-dark", String(next));
  };

  const filteredBoards = boards.filter((b) => b.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSignOut = async () => {
    await authClient.signOut();
    queryClient.setQueryData(["auth", "me"], null);
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <BoardlyBrand to="/dashboard" showName={false} size={40} className="shadow-lg shadow-blue-500/20" />
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">Mes Tableaux</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500 font-medium hidden sm:inline-block">
            {user?.name || user?.email}
          </span>
          <Button variant="ghost" size="icon" onClick={toggleDark} title={darkMode ? "Mode clair" : "Mode sombre"}>
            {darkMode ? "☀️" : "🌙"}
          </Button>
          <SettingsDialog user={user} onSignOut={handleSignOut} />
          <NewBoardDialog onCreate={(title, template) => createMutation.mutate({ title, template })} isLoading={createMutation.isPending} />
        </div>
      </header>

      {/* Search Bar */}
      {boards.length > 0 && (
        <div className="max-w-6xl mx-auto mb-8">
          <Input
            placeholder="Rechercher un tableau..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      {/* Board Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {filteredBoards.map((board) => (
            <Link to={`/board/$boardId`} params={{ boardId: board.id }} key={board.id} className="block group relative">
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 h-56 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 bg-white dark:bg-neutral-900 flex flex-col justify-between cursor-pointer overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${board.template === "blueprint" ? "bg-blue-600" : board.template === "grid" ? "bg-neutral-400" : "bg-orange-400"}`} />
                <div>
                  <h3 className="font-semibold text-lg text-neutral-800 dark:text-neutral-100 group-hover:text-blue-600 transition truncate pr-8">
                    {board.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 capitalize">Modèle {board.template}</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(board.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-4 right-4 h-8 w-8 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm("Supprimer ce tableau ?")) deleteMutation.mutate(board.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Link>
          ))}

          {filteredBoards.length === 0 && boards.length > 0 && (
            <div className="col-span-full py-12 text-center">
              <p className="text-neutral-500">Aucun tableau ne correspond à "{searchQuery}"</p>
            </div>
          )}
          {boards.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50">
              <div className="h-16 w-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                <Layout className="h-8 w-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900">Aucun tableau pour le moment</h3>
              <p className="text-neutral-500 max-w-sm mt-2 mb-6">Créez votre premier tableau pour commencer.</p>
              <NewBoardDialog onCreate={(title, template) => createMutation.mutate({ title, template })} isLoading={createMutation.isPending} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// New Board Dialog
function NewBoardDialog({ onCreate, isLoading }: { onCreate: (title: string, template: string) => void; isLoading: boolean }) {
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(title || "Untitled Board", selectedTemplate);
    setOpen(false);
    setTitle("");
    setSelectedTemplate("blank");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Tableau
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Créer un tableau</DialogTitle>
            <DialogDescription>Choisissez un modèle pour commencer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre du tableau</Label>
              <Input id="title" placeholder="Mon super projet" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Modèle</Label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { key: "blank", label: "Vide", preview: <div className="aspect-video w-full rounded-md bg-white border border-neutral-200 shadow-sm mb-2" /> },
                  { key: "grid", label: "Grille", preview: (
                    <div className="aspect-video w-full rounded-md bg-white border border-neutral-200 shadow-sm mb-2 overflow-hidden relative">
                      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#ccc 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
                    </div>
                  )},
                  { key: "blueprint", label: "Plan", preview: (
                    <div className="aspect-video w-full rounded-md bg-[#1e40af] border border-blue-900 shadow-sm mb-2 overflow-hidden relative">
                      <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                    </div>
                  )},
                ].map(({ key, label, preview }) => (
                  <div
                    key={key}
                    className={cn(
                      "cursor-pointer rounded-lg border-2 p-1 transition-all hover:border-blue-500",
                      selectedTemplate === key ? "border-blue-600 bg-blue-50" : "border-muted"
                    )}
                    onClick={() => setSelectedTemplate(key)}
                  >
                    {preview}
                    <div className="text-center text-sm font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Settings Dialog
function SettingsDialog({ user, onSignOut }: { user?: UserType | null; onSignOut: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "account">("profile");
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await authClient.updateUser({ name });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setMessage({ type: "success", text: "Profil mis à jour." });
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la mise à jour." });
    }
    setLoading(false);
  };

  const handlePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Mot de passe modifié." });
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setMessage({ type: "error", text: "Erreur. Vérifiez votre mot de passe actuel." });
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <div className="flex h-[450px]">
          <div className="w-[200px] bg-neutral-50 dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-2">
            <div className="font-semibold text-lg px-2 mb-4">Réglages</div>
            <Button variant={activeTab === "profile" ? "secondary" : "ghost"} className="justify-start gap-2" onClick={() => { setActiveTab("profile"); setMessage(null); }}>
              <User className="h-4 w-4" /> Profil
            </Button>
            <Button variant={activeTab === "account" ? "secondary" : "ghost"} className="justify-start gap-2" onClick={() => { setActiveTab("account"); setMessage(null); }}>
              <Lock className="h-4 w-4" /> Sécurité
            </Button>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle>{activeTab === "profile" ? "Mon Profil" : "Sécurité"}</DialogTitle>
              <DialogDescription>{activeTab === "profile" ? "Gérez vos informations." : "Mettez à jour votre mot de passe."}</DialogDescription>
            </DialogHeader>
            {message && (
              <div className={`p-3 rounded-md mb-4 text-sm ${message.type === "success" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                {message.text}
              </div>
            )}
            {activeTab === "profile" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onSignOut}>Se déconnecter</Button>
                  <Button onClick={handleSave} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button>
                </div>
              </div>
            )}
            {activeTab === "account" && (
              <div className="space-y-4">
                <div className="space-y-2"><Label>Mot de passe actuel</Label><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
                <div className="space-y-2"><Label>Nouveau mot de passe</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
                <div className="flex justify-end"><Button onClick={handlePassword} disabled={loading || !currentPassword || !newPassword}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mettre à jour</Button></div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
