import { memo, useState, useRef, useEffect, createElement } from "react";
import { Lock, ExternalLink } from "lucide-react";
import { LinkCardBody, LinkCardImage, LinkUrlEdge } from "./link-card-parts";
import type { Layer, LayerReaction } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas-store";
import { estimateLinkBodyHeight, LINK_CARD_GAP, LINK_URL_STRIP_HEIGHT } from "@/lib/brand-icons";

const EMPTY_REACTIONS: LayerReaction[] = [];

interface LayerPreviewProps {
  id: string;
  layer: Layer | undefined;
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  onLayerResizePointerDown: (e: React.PointerEvent, initialBounds: { x: number; y: number; width: number; height: number }) => void;
  onLayerRotatePointerDown: (e: React.PointerEvent, layerId: string) => void;
  onChange: (newValue: string) => void;
  selectionColor?: string;
  highlighted?: boolean;
}

const fontMap: Record<string, string> = {
  "font-sans": "Inter, sans-serif",
  "font-serif": "Times New Roman, serif",
  "font-mono": "monospace",
  "font-handwriting": '"Comic Sans MS", "Chalkboard SE", sans-serif',
};

const XHTML_NS = "http://www.w3.org/1999/xhtml";

function layerPos(layer: Layer) {
  return {
    x: Number(layer.x) || 0,
    y: Number(layer.y) || 0,
  };
}

function localLayerTransform(x: number, y: number, width: number, height: number, rotation: number) {
  const rot = rotation ? ` rotate(${rotation} ${width / 2} ${height / 2})` : "";
  return `translate(${x} ${y})${rot}`;
}

function foreignObjectRotation(width: number, height: number, rotation: number) {
  if (!rotation) return undefined;
  return `rotate(${rotation} ${width / 2} ${height / 2})`;
}

function XhtmlDiv(props: React.HTMLAttributes<HTMLDivElement>) {
  return createElement("div", { xmlns: XHTML_NS, ...props });
}

function getSvgPathFromPoints(points: number[][]) {
  if (!points || points.length === 0) return "";
  let d = "";
  let isNextMove = true;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point[3] === 1) { isNextMove = true; continue; }
    if (isNextMove) { d += `M ${point[0]} ${point[1]}`; isNextMove = false; }
    else d += `L ${point[0]} ${point[1]}`;
  }
  return d;
}

export const LayerPreview = memo(({ id, layer, onLayerPointerDown, onLayerResizePointerDown, onLayerRotatePointerDown, onChange, selectionColor, highlighted }: LayerPreviewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);
  const layerComments = useCanvasStore((s) => s.layerComments[id]?.length ?? 0);
  const reactions = useCanvasStore((s) => s.reactions[id] ?? EMPTY_REACTIONS);
  const toggleChecklistItem = useCanvasStore((s) => s.toggleChecklistItem);
  const updateLayer = useCanvasStore((s) => s.updateLayer);
  const fitLinkLayerToImage = useCanvasStore((s) => s.fitLinkLayerToImage);
  const readOnly = useCanvasStore((s) => s.readOnly);

  useEffect(() => {
    if (isEditing && editableRef.current) editableRef.current.focus();
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && editableRef.current && layer?.value !== undefined) {
      if (editableRef.current.innerHTML !== layer.value) editableRef.current.innerHTML = layer.value;
    }
  }, [layer?.value, isEditing]);

  if (!layer) return null;

  const isSelected = !!selectionColor;
  const isLocked = layer.locked || false;
  const rotation = layer.rotation || 0;
  const cornerRadius = layer.cornerRadius || 0;
  const stroke = layer.stroke || "transparent";
  const strokeWidth = layer.strokeWidth || 0;

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    setIsEditing(false);
    onChange(e.currentTarget.innerHTML);
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    onChange(e.currentTarget.innerHTML);
  };

  const justify = layer.alignY === "top" ? "flex-start" : layer.alignY === "bottom" ? "flex-end" : "center";
  const align = layer.alignX || "center";
  const fontFamily = layer.fontFamily ? fontMap[layer.fontFamily] : fontMap["font-sans"];
  const fontSize = layer.fontSize ? `${layer.fontSize}px` : layer.type === "Text" || layer.type === "Note" ? "16px" : `${Math.min(layer.height / 2, layer.width / 4, 16)}px`;

  const onTextPointerDown = (e: React.PointerEvent) => e.stopPropagation();

  const wrapperStyle: React.CSSProperties = { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: justify, pointerEvents: "none" };
  const editableStyle: React.CSSProperties = {
    width: "100%", outline: "none", border: "none",
    background: layer.textBackground || "transparent",
    fontFamily, fontSize, textAlign: align,
    fontWeight: layer.fontWeight || (layer.type === "Text" ? "bold" : "normal"),
    fontStyle: layer.fontStyle || "normal",
    textDecoration: layer.textDecoration || "none",
    color: layer.textColor || (layer.fill ? (parseInt(layer.fill.replace("#", ""), 16) > 0xffffff / 2 ? "black" : "white") : "black"),
    pointerEvents: isEditing ? "auto" : "none",
    overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word",
    cursor: isEditing ? "text" : "move",
    userSelect: isEditing ? "text" : "none",
  };

  let pathScaleX = 1, pathScaleY = 1, isDrawing = false;
  if (layer.type === "Path") {
    if (layer.width === 0 || layer.height === 0) { isDrawing = true; }
    else if (layer.points && layer.points.length > 0) {
      const xs = layer.points.map((p) => p[0]), ys = layer.points.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      pathScaleX = layer.width / (maxX - minX || 1);
      pathScaleY = layer.height / (maxY - minY || 1);
    }
  }

  const baseShapeStrokeWidth = cornerRadius * 2;
  const totalStrokeWidth = Math.max(baseShapeStrokeWidth, strokeWidth);
  const shapeScale = layer.width > 0 && layer.height > 0 ? Math.min(layer.width, layer.height) / (Math.min(layer.width, layer.height) + totalStrokeWidth) : 1;
  const linkCardHeight = layer.type === "Link" ? Math.max(0, layer.height - LINK_URL_STRIP_HEIGHT - LINK_CARD_GAP) : 0;
  const linkBodyHeight =
    layer.type === "Link"
      ? estimateLinkBodyHeight(layer.linkTitle || layer.url || "", !!(layer.linkAuthor || layer.linkDescription))
      : 0;
  const linkImageHeight =
    layer.type === "Link" && layer.linkImage ? Math.max(1, linkCardHeight - linkBodyHeight) : undefined;

  const { x, y } = layerPos(layer);
  const layerTransform = localLayerTransform(x, y, layer.width, layer.height, rotation);
  const foRotation = foreignObjectRotation(layer.width, layer.height, rotation);

  return (
    <g
      onPointerDown={(e) => onLayerPointerDown(e, id)}
      onDoubleClick={handleDoubleClick}
      className={highlighted ? "layer-flash" : undefined}
      style={{
        cursor: isLocked ? "default" : "move",
      }}
    >
      {layer.type === "Path" && (
        <g transform={layerTransform}>
        <path
          d={getSvgPathFromPoints(layer.points || [])}
          stroke={layer.fill || "#000"}
          strokeWidth={layer.strokeWidth || 2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={isDrawing ? 0.92 : 1}
          transform={isDrawing ? undefined : `scale(${pathScaleX}, ${pathScaleY})`}
          style={isDrawing ? undefined : { transformOrigin: "top left" }}
        />
        </g>
      )}
      {layer.type === "Line" && (
        <g transform={layerTransform}>
        <line x1={0} y1={0} x2={layer.width} y2={layer.height} stroke={layer.fill || "#111827"} strokeWidth={layer.strokeWidth || 3} strokeLinecap="round" />
        </g>
      )}
      {layer.type === "Frame" && (
        <>
          <g transform={layerTransform}>
          <rect width={layer.width} height={layer.height} rx={cornerRadius} ry={cornerRadius} fill="rgba(148,163,184,0.06)" stroke={stroke || "#94A3B8"} strokeWidth={strokeWidth || 2} strokeDasharray="8 6" />
          </g>
          <foreignObject x={x} y={y} width={layer.width} height={layer.height} transform={foRotation} style={{ overflow: "visible", pointerEvents: "none" }}>
            <XhtmlDiv style={{ ...wrapperStyle, alignItems: "flex-start", justifyContent: "flex-start" }}>
              <div ref={editableRef} contentEditable={isEditing as any} onInput={handleInput} onBlur={handleBlur} onPointerDown={onTextPointerDown} style={{ ...editableStyle, padding: "8px 12px", fontWeight: 600, fontSize: "13px", color: "#64748B" }} />
            </XhtmlDiv>
          </foreignObject>
        </>
      )}
      {(layer.type === "Column") && (
        <>
          <g transform={layerTransform}>
          <rect width={layer.width} height={layer.height} rx={cornerRadius} ry={cornerRadius} fill="rgba(59,130,246,0.04)" stroke={stroke || "#93C5FD"} strokeWidth={strokeWidth || 2} />
          </g>
          <foreignObject x={x} y={y} width={layer.width} height={32} transform={foRotation} style={{ overflow: "visible", pointerEvents: "none" }}>
            <XhtmlDiv style={{ ...wrapperStyle, alignItems: "flex-start", justifyContent: "flex-start" }}>
              <div ref={editableRef} contentEditable={isEditing as any} onInput={handleInput} onBlur={handleBlur} onPointerDown={onTextPointerDown} style={{ ...editableStyle, padding: "8px 12px", fontWeight: 700, fontSize: "12px", color: "#3B82F6", textTransform: "uppercase", letterSpacing: "0.05em" }} />
            </XhtmlDiv>
          </foreignObject>
        </>
      )}
      {layer.type === "Link" && (
        <foreignObject x={x} y={y} width={layer.width} height={layer.height} transform={foRotation} style={{ overflow: "visible" }}>
          <XhtmlDiv
            className="flex flex-col"
            style={{ width: layer.width, height: layer.height, gap: LINK_CARD_GAP }}
          >
            <div
              className="flex flex-col overflow-hidden border border-neutral-200 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900"
              style={{ borderRadius: cornerRadius || 10, height: linkCardHeight, minHeight: linkCardHeight, maxHeight: linkCardHeight }}
            >
              {layer.linkImage ? (
                <LinkCardImage
                  src={layer.linkImage}
                  provider={layer.linkProvider}
                  url={layer.url}
                  width={layer.width}
                  heightOverride={linkImageHeight}
                  imageWidth={layer.linkImageWidth}
                  imageHeight={layer.linkImageHeight}
                  linkVideoId={layer.linkVideoId}
                  linkTitle={layer.linkTitle}
                  readOnly={readOnly || isLocked}
                  onNaturalSize={(w, h) => fitLinkLayerToImage(id, w, h)}
                />
              ) : (
                <div className="flex items-center gap-2 px-3 pt-3">
                  <ExternalLink className="h-4 w-4 shrink-0 text-blue-600" />
                </div>
              )}
              <LinkCardBody layer={layer} />
            </div>
            <LinkUrlEdge
              url={layer.url}
              selected={isSelected}
              readOnly={readOnly || isLocked}
              onChange={(nextUrl) => updateLayer(id, { url: nextUrl })}
            />
          </XhtmlDiv>
        </foreignObject>
      )}
      {layer.type === "Rectangle" && (
        <>
          <g transform={layerTransform}>
          <rect width={layer.width} height={layer.height} rx={cornerRadius} ry={cornerRadius} fill={layer.fill} stroke={stroke} strokeWidth={strokeWidth} className="drop-shadow-sm" />
          </g>
          <foreignObject x={x} y={y} width={layer.width} height={layer.height} transform={foRotation} style={{ overflow: "visible", pointerEvents: "none" }}>
            <XhtmlDiv style={wrapperStyle}><div ref={editableRef} contentEditable={isEditing as any} onInput={handleInput} onBlur={handleBlur} onPointerDown={onTextPointerDown} style={{ ...editableStyle, padding: "8px" }} /></XhtmlDiv>
          </foreignObject>
        </>
      )}
      {layer.type === "Triangle" && (
        <g transform={layerTransform}>
        <g transform={`translate(${layer.width / 2}, ${layer.height / 2}) scale(${shapeScale}) translate(${-layer.width / 2}, ${-layer.height / 2})`}>
          <polygon points={`0,${layer.height} ${layer.width / 2},0 ${layer.width},${layer.height}`} fill={layer.fill} stroke={strokeWidth > 0 ? stroke : layer.fill} strokeWidth={totalStrokeWidth} strokeLinejoin="round" className="drop-shadow-sm" />
        </g>
        </g>
      )}
      {layer.type === "Diamond" && (
        <g transform={layerTransform}>
        <g transform={`translate(${layer.width / 2}, ${layer.height / 2}) scale(${shapeScale}) translate(${-layer.width / 2}, ${-layer.height / 2})`}>
          <polygon points={`${layer.width / 2},0 ${layer.width},${layer.height / 2} ${layer.width / 2},${layer.height} 0,${layer.height / 2}`} fill={layer.fill} stroke={strokeWidth > 0 ? stroke : layer.fill} strokeWidth={totalStrokeWidth} strokeLinejoin="round" className="drop-shadow-sm" />
        </g>
        </g>
      )}
      {layer.type === "Star" && (
        <g transform={layerTransform}>
        <g transform={`translate(${layer.width / 2}, ${layer.height / 2}) scale(${shapeScale}) translate(${-layer.width / 2}, ${-layer.height / 2})`}>
          <polygon points={`${layer.width * 0.5},0 ${layer.width * 0.63},${layer.height * 0.38} ${layer.width},${layer.height * 0.38} ${layer.width * 0.69},${layer.height * 0.59} ${layer.width * 0.82},${layer.height} ${layer.width * 0.5},${layer.height * 0.75} ${layer.width * 0.18},${layer.height} ${layer.width * 0.31},${layer.height * 0.59} 0,${layer.height * 0.38} ${layer.width * 0.37},${layer.height * 0.38}`} fill={layer.fill} stroke={strokeWidth > 0 ? stroke : layer.fill} strokeWidth={totalStrokeWidth} strokeLinejoin="round" className="drop-shadow-sm" />
        </g>
        </g>
      )}
      {layer.type === "Arrow" && (
        <g transform={layerTransform}>
        <g transform={`translate(${layer.width / 2}, ${layer.height / 2}) scale(${shapeScale}) translate(${-layer.width / 2}, ${-layer.height / 2})`}>
          <path d={`M 0,${layer.height * 0.3} L ${layer.width * 0.6},${layer.height * 0.3} L ${layer.width * 0.6},0 L ${layer.width},${layer.height * 0.5} L ${layer.width * 0.6},${layer.height} L ${layer.width * 0.6},${layer.height * 0.7} L 0,${layer.height * 0.7} Z`} fill={layer.fill} stroke={strokeWidth > 0 ? stroke : layer.fill} strokeWidth={totalStrokeWidth} strokeLinejoin="round" className="drop-shadow-sm" />
        </g>
        </g>
      )}
      {layer.type === "Ellipse" && (
        <>
          <g transform={layerTransform}>
          <ellipse cx={layer.width / 2} cy={layer.height / 2} rx={layer.width / 2} ry={layer.height / 2} fill={layer.fill} stroke={stroke} strokeWidth={strokeWidth} />
          </g>
          <foreignObject x={x} y={y} width={layer.width} height={layer.height} transform={foRotation} style={{ overflow: "visible", pointerEvents: "none" }}>
            <XhtmlDiv style={{ ...wrapperStyle, alignItems: "center" }}><div ref={editableRef} contentEditable={isEditing as any} onInput={handleInput} onBlur={handleBlur} onPointerDown={onTextPointerDown} style={{ ...editableStyle, width: "80%", padding: "4px" }} /></XhtmlDiv>
          </foreignObject>
        </>
      )}
      {layer.type === "Note" && (
        <foreignObject x={x} y={y} width={layer.width} height={layer.height} transform={foRotation} style={{ overflow: "visible" }}>
          <XhtmlDiv className="w-full h-full relative shadow-md flex flex-col" style={{ backgroundColor: layer.fill || "#fef3c7", borderRadius: cornerRadius }}>
            <div style={{ ...wrapperStyle, flex: layer.checklist?.length ? "0 0 auto" : 1 }}>
              <div ref={editableRef} contentEditable={isEditing as any} onInput={handleInput} onBlur={handleBlur} onPointerDown={onTextPointerDown} style={{ ...editableStyle, padding: "8px", fontFamily: layer.fontFamily ? fontMap[layer.fontFamily] : fontMap["font-handwriting"], color: layer.textColor || "#1f2937", minHeight: layer.checklist?.length ? 48 : undefined }} />
            </div>
            {layer.checklist && layer.checklist.length > 0 && (
              <div className="px-2 pb-2 space-y-1 pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
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
          </XhtmlDiv>
        </foreignObject>
      )}
      {layer.type === "Text" && (
        <foreignObject x={x} y={y} width={layer.width} height={layer.height} transform={foRotation} style={{ overflow: "visible" }}>
          <XhtmlDiv style={wrapperStyle}>
            <div ref={editableRef} contentEditable={isEditing as any} onInput={handleInput} onBlur={handleBlur} onPointerDown={onTextPointerDown} style={{ ...editableStyle, padding: layer.textBackground ? "2px 6px" : "0px", borderRadius: "4px", fontWeight: "bold", color: layer.textColor || layer.fill || "#000000", display: "inline-block", width: "auto", maxWidth: "100%" }} />
          </XhtmlDiv>
        </foreignObject>
      )}
      {layer.type === "Image" && (
        <g transform={layerTransform}>
          <defs><clipPath id={`clip-${id}`}><rect width={layer.width} height={layer.height} rx={cornerRadius} ry={cornerRadius} /></clipPath></defs>
          <image href={layer.src} width={layer.width} height={layer.height} preserveAspectRatio="none" clipPath={`url(#clip-${id})`} />
        </g>
      )}

      {(layerComments > 0 || reactions.length > 0) && (
        <g transform={layerTransform}>
        <g transform={`translate(${layer.width - 8}, -8)`} className="pointer-events-none">
          {layerComments > 0 && (
            <circle r={8} fill="#2563EB" />
          )}
          {reactions.length > 0 && (
            <text x={layerComments > 0 ? 14 : 0} y={4} fontSize={10}>{reactions[0].emoji}</text>
          )}
        </g>
        </g>
      )}

      {isSelected && (
        <g transform={layerTransform}>
          <>
          <rect className={`stroke-blue-500 stroke-2 fill-transparent pointer-events-none ${isLocked ? "stroke-red-400 opacity-50" : ""}`} x={-2} y={-2} width={layer.width + 4} height={layer.height + 4} />
          {isLocked ? (
            <g transform={`translate(${layer.width / 2}, -22)`}>
              <circle r="10" fill="#ef4444" className="shadow-sm" />
              <Lock size={12} className="text-white" style={{ transform: "translate(-6px, -6px)" }} />
            </g>
          ) : (
            <>
              <rect className="fill-white stroke-blue-500 stroke-1 cursor-nwse-resize" x={layer.width - 6} y={layer.height - 6} width={12} height={12} onPointerDown={(e) => { e.stopPropagation(); onLayerResizePointerDown(e, { x: layer.x, y: layer.y, width: layer.width, height: layer.height }); }} />
              <circle className="fill-white stroke-blue-500 stroke-1 cursor-grab active:cursor-grabbing" cx={layer.width / 2} cy={-20} r={6} onPointerDown={(e) => { e.stopPropagation(); onLayerRotatePointerDown(e, id); }} />
              <line x1={layer.width / 2} y1={-2} x2={layer.width / 2} y2={-14} className="stroke-blue-500 stroke-1" />
            </>
          )}
          </>
        </g>
      )}
    </g>
  );
});

LayerPreview.displayName = "LayerPreview";
