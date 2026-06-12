import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { Canvas } from "@/components/board/canvas";
import { useCanvasStore } from "@/store/canvas-store";
import { RouteLoading } from "@/components/route-loading";
import { BoardlyBrand } from "@/components/boardly-brand";
import { Button } from "@/components/ui/button";
import type { BoardCanvasData } from "@/lib/types";

type PublicBoard = {
  id: string;
  title: string;
  template: string;
  authorName?: string | null;
};

export function SharePage() {
  const { boardId } = useParams({ from: "/share/$boardId" });
  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const resetBoard = useCanvasStore((s) => s.resetBoard);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      resetBoard();
      try {
        const meta = await apiFetch<PublicBoard>(`/api/public/boards/${boardId}`);
        const content = await apiFetch<{ canvasData: BoardCanvasData | null }>(`/api/public/boards/${boardId}/content`);
        if (cancelled) return;
        setBoard(meta);
        if (content.canvasData) {
          useCanvasStore.setState({
            layers: content.canvasData.layers || {},
            layerIds: content.canvasData.layerIds || [],
            connections: content.canvasData.connections || [],
            layerComments: content.canvasData.layerComments || {},
            reactions: content.canvasData.reactions || {},
            brandColors: content.canvasData.brandColors || [],
            readOnly: true,
          });
        }
        setReady(true);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [boardId, resetBoard]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <BoardlyBrand to="/" className="text-xl" />
        <div>
          <h1 className="text-2xl font-bold">Board privé ou introuvable</h1>
          <p className="text-neutral-500 mt-2">Le propriétaire doit activer le lien public.</p>
        </div>
        <Button asChild><Link to="/">Accueil</Link></Button>
      </div>
    );
  }

  if (!ready || !board) return <RouteLoading label="Chargement du board public…" />;

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Canvas template={board.template || "blank"} title={board.title} boardId={boardId} readOnly isPublic />
    </div>
  );
}
