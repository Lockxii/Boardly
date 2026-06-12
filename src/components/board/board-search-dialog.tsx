import { useMemo, useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";

export function BoardSearchDialog() {
  const showSearch = useCanvasStore((s) => s.showSearch);
  const setShowSearch = useCanvasStore((s) => s.setShowSearch);
  const layers = useCanvasStore((s) => s.layers);
  const layerIds = useCanvasStore((s) => s.layerIds);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const camera = useCanvasStore((s) => s.camera);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearch) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [showSearch]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return layerIds
      .map((id) => ({ id, layer: layers[id] }))
      .filter(({ layer }) => {
        if (!layer) return false;
        const hay = [
          layer.value,
          layer.linkTitle,
          layer.linkDescription,
          layer.url,
          ...(layer.checklist?.map((c) => c.text) || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q) || layer.type.toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [query, layerIds, layers]);

  if (!showSearch) return null;

  const focusLayer = (id: string) => {
    const layer = layers[id];
    if (!layer) return;
    setSelection([id]);
    setCamera({
      x: window.innerWidth / 2 - (layer.x + layer.width / 2) * camera.zoom,
      y: window.innerHeight / 2 - (layer.y + layer.height / 2) * camera.zoom,
      zoom: camera.zoom,
    });
    setShowSearch(false);
  };

  return (
    <div className="cmd-overlay" onClick={() => setShowSearch(false)}>
      <div className="w-full max-w-lg bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-neutral-100 dark:border-neutral-700">
          <Search className="h-5 w-5 text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setShowSearch(false)}
            placeholder="Rechercher dans le board…"
            className="flex-1 text-sm bg-transparent outline-none dark:text-white placeholder:text-neutral-400"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-2">
          {query && results.length === 0 && (
            <p className="text-center text-sm text-neutral-500 py-6">Aucun résultat</p>
          )}
          {results.map(({ id, layer }) => (
            <button
              key={id}
              type="button"
              className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
              onClick={() => focusLayer(id)}
            >
              <span className="font-medium">{layer.type}</span>
              <span className="text-neutral-500 ml-2 truncate">
                {(layer.linkTitle || layer.value?.replace(/<[^>]+>/g, "") || layer.url || "").slice(0, 60)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
