import { useState, useRef, useEffect, useMemo } from "react";
import { Send, X, Paperclip, File as FileIcon, Loader2, Image as ImageIcon, Link2, MousePointer2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useCanvasStore } from "@/store/canvas-store";
import { useDraggable } from "@/lib/use-draggable";
import { toast } from "sonner";

interface ChatPanelProps { onClose: () => void; }

export function ChatPanel({ onClose }: ChatPanelProps) {
  const chatMessages = useCanvasStore((s) => s.chatMessages);
  const layers = useCanvasStore((s) => s.layers);
  const selection = useCanvasStore((s) => s.selection);
  const sendMessage = useCanvasStore((s) => s.sendMessage);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const [newMessage, setNewMessage] = useState("");
  const [attachment, setAttachment] = useState<{ type: "image" | "file"; url: string; name: string } | null>(null);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drag = useDraggable<HTMLDivElement>({ storageKey: "chat-panel" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage, attachment || undefined, linkedIds.length > 0 ? linkedIds : undefined);
    setNewMessage("");
    setAttachment(null);
    setLinkedIds([]);
  };

  const handleLinkSelection = () => {
    if (!selection || selection.length === 0) { toast.error("Sélectionnez d'abord des éléments."); return; }
    setLinkedIds([...selection]);
    toast.success(`${selection.length} élément${selection.length > 1 ? "s" : ""} lié${selection.length > 1 ? "s" : ""} !`);
  };

  const zoomToLayers = (ids: string[]) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, found = false;
    ids.forEach((id) => {
      const layer = layers[id];
      if (layer) { found = true; minX = Math.min(minX, layer.x); minY = Math.min(minY, layer.y); maxX = Math.max(maxX, layer.x + layer.width); maxY = Math.max(maxY, layer.y + layer.height); }
    });
    if (found) {
      const width = maxX - minX, height = maxY - minY;
      const centerX = minX + width / 2, centerY = minY + height / 2;
      const padding = 100;
      const zoom = Math.min((window.innerWidth - 400) / (width + padding), (window.innerHeight - 100) / (height + padding), 2);
      setCamera({ x: window.innerWidth / 2 - centerX * zoom, y: window.innerHeight / 2 - centerY * zoom, zoom });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 10MB)"); return; }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Data = ev.target?.result as string;
      try {
        const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, type: file.type, size: file.size, data: base64Data }), credentials: "include" });
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();
        setAttachment({ type: file.type.startsWith("image/") ? "image" : "file", url, name: file.name });
      } catch (error) { toast.error("Erreur lors de l'envoi du fichier."); }
      finally { setIsUploading(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chatMessages.length, attachment, linkedIds]);

  return (
    <div ref={drag.ref} style={drag.style} className="absolute top-16 right-4 w-80 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 flex flex-col max-h-[calc(100vh-100px)] pointer-events-auto z-50">
      <div className="flex items-center justify-between p-3 border-b border-neutral-100 dark:border-neutral-700">
        <div className="flex items-center gap-1.5">
          <div {...drag.handleProps} className="-ml-1 text-neutral-300 dark:text-neutral-600" title="Déplacer"><GripVertical className="h-4 w-4" /></div>
          <h3 className="font-semibold text-sm dark:text-white">Discussion</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4 min-h-[200px]">
        {chatMessages.length === 0 ? (
          <div className="text-center text-xs text-neutral-400 mt-4">Aucun message. Lancez la discussion !</div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.userId === "local";
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {!isMe && (
                    <div className="h-4 w-4 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                      <span className="text-[8px] font-bold">{msg.userName[0]}</span>
                    </div>
                  )}
                  <span className="text-[10px] font-medium text-neutral-500">
                    {isMe ? "Moi" : msg.userName} • {formatDistanceToNow(msg.timestamp, { addSuffix: true, locale: fr })}
                  </span>
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm max-w-[90%] break-words ${isMe ? "bg-blue-500 text-white rounded-tr-none" : "bg-neutral-100 dark:bg-neutral-700 dark:text-white rounded-tl-none"}`}>
                  {msg.attachment && (
                    <div className="mb-2">
                      {msg.attachment.type === "image" && msg.attachment.url.startsWith("data:image") ? (
                        <div className="cursor-pointer hover:opacity-90 transition" onClick={() => window.open(msg.attachment!.url, "_blank")}>
                          <img src={msg.attachment.url} alt="attachment" className="rounded-lg max-w-full h-auto max-h-60 object-contain bg-black/5 dark:bg-white/5 border border-neutral-200 dark:border-neutral-700" />
                        </div>
                      ) : (
                        <a href={msg.attachment.url} download={msg.attachment.name} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition group">
                          <div className="h-10 w-10 bg-white dark:bg-neutral-900 rounded-md flex items-center justify-center shadow-sm">
                            {msg.attachment.type === "image" ? <ImageIcon className="h-5 w-5 text-purple-500" /> : <FileIcon className="h-5 w-5 text-blue-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate dark:text-neutral-200">{msg.attachment.name}</p>
                            <p className="text-[10px] text-neutral-500 uppercase">Télécharger</p>
                          </div>
                        </a>
                      )}
                    </div>
                  )}
                  {msg.linkedLayerIds && msg.linkedLayerIds.length > 0 && (
                    <button onClick={() => zoomToLayers(msg.linkedLayerIds!)} className={`mb-2 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition ${isMe ? "bg-white/20 hover:bg-white/30 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"}`}>
                      <MousePointer2 className="h-3.5 w-3.5" />
                      Voir {msg.linkedLayerIds.length} élément{msg.linkedLayerIds.length > 1 ? "s" : ""}
                    </button>
                  )}
                  <div>{msg.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(attachment || linkedIds.length > 0) && (
        <div className="px-3 pt-3 pb-1 flex flex-col gap-2 border-t border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
          {attachment && (
            <div className="flex items-center gap-2">
              <div className="relative">
                {attachment.type === "image" ? <img src={attachment.url} className="h-10 w-10 rounded object-cover border" /> : <div className="h-10 w-10 rounded bg-neutral-200 flex items-center justify-center"><FileIcon className="h-5 w-5" /></div>}
                <button onClick={() => setAttachment(null)} className="absolute -top-1.5 -right-1.5 bg-neutral-500 text-white rounded-full p-0.5 hover:bg-red-500"><X className="h-3 w-3" /></button>
              </div>
              <span className="text-xs text-neutral-500 truncate">{attachment.name}</span>
            </div>
          )}
          {linkedIds.length > 0 && (
            <div className="flex items-center gap-2 p-1.5 bg-blue-100 dark:bg-blue-900/20 rounded-md">
              <Link2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">{linkedIds.length} élément{linkedIds.length > 1 ? "s" : ""} lié{linkedIds.length > 1 ? "s" : ""}</span>
              <button onClick={() => setLinkedIds([])} className="ml-auto hover:bg-blue-200 dark:hover:bg-blue-800 p-0.5 rounded"><X className="h-3 w-3 text-blue-600 dark:text-blue-400" /></button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 border-t border-neutral-100 dark:border-neutral-700 flex gap-1 items-center relative">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
        <div className="flex gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-neutral-500 hover:text-blue-500" onClick={() => fileInputRef.current?.click()} title="Joindre" disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className={`h-9 w-9 shrink-0 ${linkedIds.length > 0 ? "text-blue-500 bg-blue-50 dark:bg-blue-900/20" : "text-neutral-500"}`} onClick={handleLinkSelection} title="Lier la sélection">
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
        <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={isUploading ? "Envoi..." : "Message..."} className="flex-1 h-9 text-sm" disabled={isUploading} />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={(!newMessage.trim() && !attachment && linkedIds.length === 0) || isUploading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
