import { memo, useMemo, useRef, useEffect, useState } from "react";
import { Lock, Mic } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import { getViewportCanvasBounds, isLayerInViewport } from "@/lib/motion-utils";
import { isHtmlLayerType } from "@/lib/html-layer-types";
import type { Layer } from "@/lib/types";
import { LinkCardBody, LinkCardImage, LinkTweetEmbed, LinkUrlEdge } from "./link-card-parts";
import { estimateLinkBodyHeight, LINK_CARD_GAP, LINK_URL_STRIP_HEIGHT, resolveLinkProvider } from "@/lib/brand-icons";

const fontMap: Record<string, string> = {
  "font-sans": "Inter, sans-serif",
  "font-serif": "Times New Roman, serif",
  "font-mono": "monospace",
  "font-handwriting": '"Comic Sans MS", "Chalkboard SE", sans-serif',
};

function formatAudioDuration(totalSeconds?: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type HtmlLayerOverlayProps = {
  camera: { x: number; y: number; zoom: number };
  readOnly?: boolean;
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  onLayerResizePointerDown: (
    e: React.PointerEvent,
    initialBounds: { x: number; y: number; width: number; height: number }
  ) => void;
  onLayerRotatePointerDown: (e: React.PointerEvent, layerId: string) => void;
  onChange: (id: string, val: string) => void;
};

function HtmlLayerItem({
  id,
  layer,
  selected,
  highlighted,
  readOnly,
  onLayerPointerDown,
  onLayerResizePointerDown,
  onLayerRotatePointerDown,
  onChange,
}: {
  id: string;
  layer: Layer;
  selected: boolean;
  highlighted: boolean;
  readOnly?: boolean;
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  onLayerResizePointerDown: (
    e: React.PointerEvent,
    initialBounds: { x: number; y: number; width: number; height: number }
  ) => void;
  onLayerRotatePointerDown: (e: React.PointerEvent, layerId: string) => void;
  onChange: (id: string, val: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);
  const fitLinkLayerToImage = useCanvasStore((s) => s.fitLinkLayerToImage);
  const toggleChecklistItem = useCanvasStore((s) => s.toggleChecklistItem);
  const updateLayer = useCanvasStore((s) => s.updateLayer);

  const x = Number(layer.x) || 0;
  const y = Number(layer.y) || 0;
  const rotation = layer.rotation || 0;
  const cornerRadius = layer.cornerRadius || 0;
  const isLocked = layer.locked || false;

  useEffect(() => {
    if (isEditing && editableRef.current) editableRef.current.focus();
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && editableRef.current && layer.value !== undefined) {
      if (editableRef.current.innerHTML !== layer.value) editableRef.current.innerHTML = layer.value;
    }
  }, [layer.value, isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isLocked || readOnly) return;
    e.stopPropagation();
    useCanvasStore.getState().pushHistory();
    setIsEditing(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    setIsEditing(false);
    onChange(id, e.currentTarget.innerHTML);
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    onChange(id, e.currentTarget.innerHTML);
  };

  const onTextPointerDown = (e: React.PointerEvent) => e.stopPropagation();

  const fontFamily = layer.fontFamily ? fontMap[layer.fontFamily] : fontMap["font-sans"];
  const fontSize = layer.fontSize ? `${layer.fontSize}px` : layer.type === "Text" || layer.type === "Note" ? "16px" : "16px";

  const editableStyle: React.CSSProperties = {
    width: "100%",
    outline: "none",
    border: "none",
    background: layer.textBackground || "transparent",
    fontFamily,
    fontSize,
    textAlign: layer.alignX || "center",
    fontWeight: layer.fontWeight || (layer.type === "Text" ? "bold" : "normal"),
    fontStyle: layer.fontStyle || "normal",
    textDecoration: layer.textDecoration || "none",
    color: layer.textColor || (layer.type === "Note" ? "#1f2937" : layer.fill || "#000"),
    pointerEvents: isEditing ? "auto" : "none",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    userSelect: isEditing ? "text" : "none",
  };

  const linkCardHeight =
    layer.type === "Link" ? Math.max(0, layer.height - LINK_URL_STRIP_HEIGHT - LINK_CARD_GAP) : 0;
  const resolvedLinkProvider = layer.type === "Link" ? resolveLinkProvider(layer.linkProvider, layer.url) : "generic";
  const isTwitterEmbedOnly = layer.type === "Link" && resolvedLinkProvider === "twitter" && !layer.linkImage;
  const linkBodyHeight =
    layer.type === "Link"
      ? estimateLinkBodyHeight(
          layer.linkTitle || layer.url || "",
          !!(layer.linkAuthor || layer.linkDescription),
          resolvedLinkProvider,
        )
      : 0;
  const linkImageHeight =
    layer.type === "Link" && layer.linkImage ? Math.max(1, linkCardHeight - linkBodyHeight) : undefined;

  return (
    <div
      className={`html-layer-item pointer-events-auto absolute ${highlighted ? "layer-flash-html" : ""}`}
      style={{
        left: x,
        top: y,
        width: layer.width,
        height: layer.height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: `${layer.width / 2}px ${layer.height / 2}px`,
        cursor: isLocked ? "default" : "move",
        zIndex: selected ? 2 : 1,
      }}
      onPointerDown={(e) => onLayerPointerDown(e, id)}
      onDoubleClick={handleDoubleClick}
    >
      {layer.type === "Link" && (
        <div className="flex h-full flex-col" style={{ gap: LINK_CARD_GAP }}>
          <div
            className="flex flex-col overflow-hidden border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
            style={{
              borderRadius: cornerRadius || 10,
              height: linkCardHeight,
              minHeight: linkCardHeight,
              maxHeight: linkCardHeight,
              boxShadow: "0 4px 14px rgba(15, 23, 42, 0.12)",
            }}
          >
            {isTwitterEmbedOnly ? (
              <LinkTweetEmbed layer={layer} height={linkCardHeight} />
            ) : layer.linkImage ? (
              <LinkCardImage
                src={layer.linkImage}
                provider={layer.linkProvider}
                url={layer.url}
                width={layer.width}
                heightOverride={linkImageHeight}
                imageWidth={layer.linkImageWidth}
                imageHeight={layer.linkImageHeight}
                linkVideoId={layer.linkVideoId}
                linkVideoSrc={layer.linkVideoSrc}
                linkMediaType={layer.linkMediaType}
                linkTitle={layer.linkTitle}
                readOnly={readOnly || isLocked}
                onNaturalSize={(w, h) => fitLinkLayerToImage(id, w, h)}
              />
            ) : null}
            {!isTwitterEmbedOnly && <LinkCardBody layer={layer} />}
          </div>
          <LinkUrlEdge
            url={layer.url}
            selected={selected}
            readOnly={readOnly || isLocked}
            onChange={(nextUrl) => updateLayer(id, { url: nextUrl }, { history: true })}
          />
        </div>
      )}

      {layer.type === "Image" && layer.src && (
        <img
          src={layer.src}
          alt=""
          draggable={false}
          className="h-full w-full select-none"
          style={{
            borderRadius: cornerRadius || 0,
            objectFit: "fill",
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.1)",
          }}
        />
      )}

      {layer.type === "Audio" && (
        <div
          className="flex h-full w-full items-center gap-2 border border-neutral-200 bg-white px-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
          style={{ borderRadius: cornerRadius || 12 }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <Mic className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
              Note vocale · {formatAudioDuration(layer.audioDuration)}
            </div>
            <audio
              src={layer.src}
              controls
              preload="metadata"
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-0.5 h-8 w-full"
            />
          </div>
        </div>
      )}

      {layer.type === "Note" && (
        <div
          className="flex h-full w-full flex-col shadow-md"
          style={{ backgroundColor: layer.fill || "#fef3c7", borderRadius: cornerRadius || 8 }}
        >
          <div
            ref={editableRef}
            contentEditable={isEditing}
            onInput={handleInput}
            onBlur={handleBlur}
            onPointerDown={onTextPointerDown}
            style={{
              ...editableStyle,
              padding: "8px",
              fontFamily: layer.fontFamily ? fontMap[layer.fontFamily] : fontMap["font-handwriting"],
              flex: layer.checklist?.length ? "0 0 auto" : 1,
            }}
          />
          {layer.checklist && layer.checklist.length > 0 && (
            <div className="space-y-1 px-2 pb-2 pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
              {layer.checklist.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={readOnly}
                    onChange={() => toggleChecklistItem(id, item.id)}
                    className="rounded"
                  />
                  <span className={item.done ? "line-through opacity-60" : ""}>{item.text}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {layer.type === "Text" && (
        <div ref={editableRef} contentEditable={isEditing} onInput={handleInput} onBlur={handleBlur} onPointerDown={onTextPointerDown} style={{
          ...editableStyle,
          padding: layer.textBackground ? "2px 6px" : "0",
          borderRadius: 4,
          fontWeight: "bold",
          display: "inline-block",
          width: "auto",
          maxWidth: "100%",
        }} />
      )}

      {selected && !readOnly && (
        <>
          <div
            className={`pointer-events-none absolute inset-0 rounded-sm border-2 ${isLocked ? "border-red-400/50" : "border-blue-500"}`}
            style={{ margin: -2 }}
          />
          {!isLocked && (
            <>
              <div
                className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-nwse-resize border border-blue-500 bg-white"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onLayerResizePointerDown(e, { x, y, width: layer.width, height: layer.height });
                }}
              />
              <div
                className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-[22px] cursor-grab rounded-full border border-blue-500 bg-white active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onLayerRotatePointerDown(e, id);
                }}
              />
              <div className="pointer-events-none absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 -translate-y-3 bg-blue-500" />
            </>
          )}
          {isLocked && (
            <div className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-[22px] items-center justify-center rounded-full bg-red-500 p-1">
              <Lock size={12} className="text-white" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const HtmlLayerOverlay = memo(function HtmlLayerOverlay({
  camera,
  readOnly,
  onLayerPointerDown,
  onLayerResizePointerDown,
  onLayerRotatePointerDown,
  onChange,
}: HtmlLayerOverlayProps) {
  const layerIds = useCanvasStore((s) => s.layerIds);
  const layers = useCanvasStore((s) => s.layers);
  const selection = useCanvasStore((s) => s.selection);
  const highlightedLayerIds = useCanvasStore((s) => s.highlightedLayerIds);

  const viewport = useMemo(() => getViewportCanvasBounds(camera), [camera]);

  const visibleIds = useMemo(() => {
    return layerIds.filter((id) => {
      const layer = layers[id];
      return layer && isHtmlLayerType(layer.type) && isLayerInViewport(layer, viewport);
    });
  }, [layerIds, layers, viewport]);

  if (visibleIds.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          willChange: "transform",
        }}
      >
        {visibleIds.map((id) => {
          const layer = layers[id];
          if (!layer) return null;
          return (
            <HtmlLayerItem
              key={id}
              id={id}
              layer={layer}
              selected={selection.includes(id)}
              highlighted={highlightedLayerIds.includes(id)}
              readOnly={readOnly}
              onLayerPointerDown={onLayerPointerDown}
              onLayerResizePointerDown={onLayerResizePointerDown}
              onLayerRotatePointerDown={onLayerRotatePointerDown}
              onChange={onChange}
            />
          );
        })}
      </div>
    </div>
  );
});
