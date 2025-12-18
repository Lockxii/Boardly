"use client";

import { useStorage } from "@/liveblocks.config";
import { memo, useState, useRef, useEffect } from "react";

interface LayerPreviewProps {
  id: string;
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  onLayerResizePointerDown: (e: React.PointerEvent, initialBounds: { x: number, y: number, width: number, height: number }) => void;
  onLayerRotatePointerDown: (e: React.PointerEvent, layerId: string) => void;
  onChange: (newValue: string) => void;
  selectionColor?: string;
}

const fontMap: Record<string, string> = {
    "font-sans": "Inter, sans-serif",
    "font-serif": "Times New Roman, serif",
    "font-mono": "monospace",
    "font-handwriting": "\"Comic Sans MS\", \"Chalkboard SE\", sans-serif"
};

function getSvgPathFromPoints(points: number[][]) {
    if (!points || points.length === 0) return "";
    
    let d = "";
    let isNextMove = true;

    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point[3] === 1) {
            isNextMove = true;
            continue;
        }

        if (isNextMove) {
            d += `M ${point[0]} ${point[1]}`;
            isNextMove = false;
        } else {
            d += `L ${point[0]} ${point[1]}`;
        }
    }
    
    return d;
}

export const LayerPreview = memo(({ id, onLayerPointerDown, onLayerResizePointerDown, onLayerRotatePointerDown, onChange, selectionColor }: LayerPreviewProps) => {
  const layer = useStorage((root) => root.layers.get(id));
  const [isEditing, setIsEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);
  
  const isEditingRef = useRef(false);

  useEffect(() => {
    isEditingRef.current = isEditing;
    if (isEditing && editableRef.current) {
        editableRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
      if (!isEditing && editableRef.current && layer?.value !== undefined) {
          if (editableRef.current.innerHTML !== layer.value) {
              editableRef.current.innerHTML = layer.value;
          }
      }
  }, [layer?.value, isEditing]);

  useEffect(() => {
      if (editableRef.current && layer?.value && !editableRef.current.innerHTML) {
          editableRef.current.innerHTML = layer.value;
      }
  }, []);

  if (!layer) {
    return null;
  }

  const isSelected = !!selectionColor;
  const rotation = layer.rotation || 0;
  
  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      setIsEditing(false);
      onChange(e.currentTarget.innerHTML);
  };

  const justify = layer.alignY === "top" ? "flex-start" : layer.alignY === "bottom" ? "flex-end" : "center";
  const align = layer.alignX || "center";
  const fontFamily = layer.fontFamily ? fontMap[layer.fontFamily] : fontMap["font-sans"];
  
  const defaultShapeFontSize = Math.min(layer.height / 2, layer.width / 4, 16);
  const fontSize = layer.fontSize ? `${layer.fontSize}px` : (layer.type === "Text" || layer.type === "Note" ? "16px" : `${defaultShapeFontSize}px`);

  const onTextPointerDown = (e: React.PointerEvent) => {
      e.stopPropagation();
  };

  const wrapperStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: justify,
      pointerEvents: "none"
  };

  const editableStyle: React.CSSProperties = {
      width: "100%",
      outline: "none",
      border: "none",
      background: "transparent",
      fontFamily: fontFamily,
      fontSize: fontSize,
      textAlign: align,
      fontWeight: layer.fontWeight || (layer.type === "Text" ? "bold" : "normal"),
      fontStyle: layer.fontStyle || "normal",
      textDecoration: layer.textDecoration || "none",
      color: layer.textColor || (layer.fill ? (parseInt(layer.fill.replace('#', ''), 16) > 0xffffff / 2 ? 'black' : 'white') : 'black'),
      pointerEvents: isEditing ? "auto" : "none",
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      cursor: isEditing ? "text" : "move",
      userSelect: isEditing ? "text" : "none",
  };

  let pathScaleX = 1;
  let pathScaleY = 1;
  let isDrawing = false;
  
  if (layer.type === "Path") {
      if (layer.width === 0 || layer.height === 0) {
          isDrawing = true;
          pathScaleX = 1;
          pathScaleY = 1;
      } else if (layer.points && layer.points.length > 0) {
          const xs = layer.points.map(p => p[0]);
          const ys = layer.points.map(p => p[1]);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          
          const originalWidth = maxX - minX || 1;
          const originalHeight = maxY - minY || 1;
          
          pathScaleX = layer.width / originalWidth;
          pathScaleY = layer.height / originalHeight;
      }
  }

  const cornerRadius = layer.cornerRadius || 0;
  
  // Helper for rounded shapes (non-rectangles)
  // CornerRadius for stroke-linejoin="round" is strokeWidth / 2
  const shapeStrokeWidth = cornerRadius * 2;
  // Scale down to keep shape within bounds when stroke is added
  const shapeScale = layer.width > 0 && layer.height > 0 ? (Math.min(layer.width, layer.height) / (Math.min(layer.width, layer.height) + shapeStrokeWidth)) : 1;

  return (
    <g
      onPointerDown={(e) => onLayerPointerDown(e, id)}
      onDoubleClick={handleDoubleClick}
      style={{
        transform: `translate(${layer.x}px, ${layer.y}px) rotate(${rotation}deg)`,
        transformOrigin: `${layer.width / 2}px ${layer.height / 2}px`
      }}
    >
      {layer.type === "Path" && (
          <path
              d={getSvgPathFromPoints(layer.points || [])}
              stroke={isDrawing ? "#9ca3af" : (layer.fill || "#000")}
              strokeWidth={layer.strokeWidth || 2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={isDrawing ? 0.3 : 1}
              transform={`scale(${pathScaleX}, ${pathScaleY})`}
              style={{ transformOrigin: "top left" }}
          />
      )}
      {layer.type === "Rectangle" && (
         <>
             <rect
                width={layer.width}
                height={layer.height}
                rx={cornerRadius}
                ry={cornerRadius}
                fill={layer.fill}
                className="drop-shadow-sm"
             />
             <foreignObject width={layer.width} height={layer.height} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                <div style={wrapperStyle}>
                    <div 
                        ref={editableRef}
                        contentEditable={isEditing}
                        onBlur={handleBlur}
                        onPointerDown={onTextPointerDown}
                        style={{...editableStyle, padding: '8px'}}
                    />
                </div>
             </foreignObject>
         </>
      )}
      {layer.type === "Triangle" && (
          <g transform={`translate(${layer.width/2}, ${layer.height/2}) scale(${shapeScale}) translate(${-layer.width/2}, ${-layer.height/2})`}>
            <polygon
                points={`0,${layer.height} ${layer.width / 2},0 ${layer.width},${layer.height}`}
                fill={layer.fill}
                stroke={layer.fill}
                strokeWidth={shapeStrokeWidth}
                strokeLinejoin="round"
                className="drop-shadow-sm"
            />
          </g>
      )}
      {layer.type === "Diamond" && (
          <g transform={`translate(${layer.width/2}, ${layer.height/2}) scale(${shapeScale}) translate(${-layer.width/2}, ${-layer.height/2})`}>
            <polygon
                points={`${layer.width / 2},0 ${layer.width},${layer.height / 2} ${layer.width / 2},${layer.height} 0,${layer.height / 2}`}
                fill={layer.fill}
                stroke={layer.fill}
                strokeWidth={shapeStrokeWidth}
                strokeLinejoin="round"
                className="drop-shadow-sm"
            />
          </g>
      )}
      {layer.type === "Star" && (
          <g transform={`translate(${layer.width/2}, ${layer.height/2}) scale(${shapeScale}) translate(${-layer.width/2}, ${-layer.height/2})`}>
            <polygon
                points={`
                    ${layer.width * 0.5},${layer.height * 0} 
                    ${layer.width * 0.63},${layer.height * 0.38} 
                    ${layer.width * 1},${layer.height * 0.38} 
                    ${layer.width * 0.69},${layer.height * 0.59} 
                    ${layer.width * 0.82},${layer.height * 1} 
                    ${layer.width * 0.5},${layer.height * 0.75} 
                    ${layer.width * 0.18},${layer.height * 1} 
                    ${layer.width * 0.31},${layer.height * 0.59} 
                    ${layer.width * 0},${layer.height * 0.38} 
                    ${layer.width * 0.37},${layer.height * 0.38}
                `}
                fill={layer.fill}
                stroke={layer.fill}
                strokeWidth={shapeStrokeWidth}
                strokeLinejoin="round"
                className="drop-shadow-sm"
            />
          </g>
      )}
      {layer.type === "Arrow" && (
          <g transform={`translate(${layer.width/2}, ${layer.height/2}) scale(${shapeScale}) translate(${-layer.width/2}, ${-layer.height/2})`}>
            <path
                d={`
                    M 0,${layer.height * 0.3} 
                    L ${layer.width * 0.6},${layer.height * 0.3} 
                    L ${layer.width * 0.6},0 
                    L ${layer.width},${layer.height * 0.5} 
                    L ${layer.width * 0.6},${layer.height} 
                    L ${layer.width * 0.6},${layer.height * 0.7} 
                    L 0,${layer.height * 0.7} 
                    Z
                `}
                fill={layer.fill}
                stroke={layer.fill}
                strokeWidth={shapeStrokeWidth}
                strokeLinejoin="round"
                className="drop-shadow-sm"
            />
          </g>
      )}
      {layer.type === "Ellipse" && (
         <>
             <ellipse
                cx={layer.width / 2}
                cy={layer.height / 2}
                rx={layer.width / 2}
                ry={layer.height / 2}
                fill={layer.fill}
             />
             <foreignObject width={layer.width} height={layer.height} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                 <div style={{...wrapperStyle, alignItems: 'center'}}>
                     <div 
                        ref={editableRef}
                        contentEditable={isEditing}
                        onBlur={handleBlur}
                        onPointerDown={onTextPointerDown}
                        style={{...editableStyle, width: '80%', padding: '4px'}}
                    />
                 </div>
             </foreignObject>
         </>
      )}
      {layer.type === "Note" && (
        <foreignObject width={layer.width} height={layer.height} style={{ overflow: 'visible' }}>
             <div 
                className="w-full h-full relative shadow-md flex flex-col"
                style={{ 
                    backgroundColor: layer.fill ? layer.fill : "#fef3c7",
                    borderRadius: cornerRadius
                }}
             >
                <div style={wrapperStyle}>
                    <div 
                        ref={editableRef}
                        contentEditable={isEditing}
                        onBlur={handleBlur}
                        onPointerDown={onTextPointerDown}
                        style={{...editableStyle, padding: '8px', fontFamily: layer.fontFamily ? fontMap[layer.fontFamily] : fontMap["font-handwriting"], color: layer.textColor || "#1f2937"}}
                    />
                </div>
             </div>
        </foreignObject>
      )}
      {layer.type === "Text" && (
        <foreignObject width={layer.width} height={layer.height} style={{ overflow: 'visible' }}>
            <div style={wrapperStyle}>
                <div 
                    ref={editableRef}
                    contentEditable={isEditing}
                    onBlur={handleBlur}
                    onPointerDown={onTextPointerDown}
                    style={{...editableStyle, padding: '0px', fontWeight: 'bold', color: layer.textColor || layer.fill || "#000000"}}
                />
            </div>
        </foreignObject>
      )}
      {layer.type === "Image" && (
        <>
            <defs>
                <clipPath id={`clip-${id}`}>
                    <rect 
                        width={layer.width} 
                        height={layer.height} 
                        rx={cornerRadius} 
                        ry={cornerRadius} 
                    />
                </clipPath>
            </defs>
            <image 
                href={layer.src}
                width={layer.width}
                height={layer.height}
                preserveAspectRatio="none"
                clipPath={`url(#clip-${id})`}
            />
        </>
      )}

      {isSelected && (
          <>
            <rect
                className="stroke-blue-500 stroke-2 fill-transparent pointer-events-none"
                x={-2}
                y={-2}
                width={layer.width + 4}
                height={layer.height + 4}
            />
             <rect
                className="fill-white stroke-blue-500 stroke-1 cursor-nwse-resize"
                x={layer.width - 6}
                y={layer.height - 6}
                width={12}
                height={12}
                onPointerDown={(e) => {
                    e.stopPropagation(); 
                    onLayerResizePointerDown(e, { x: layer.x, y: layer.y, width: layer.width, height: layer.height });
                }}
            />
            <circle
                className="fill-white stroke-blue-500 stroke-1 cursor-grab active:cursor-grabbing"
                cx={layer.width / 2}
                cy={-20}
                r={6}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onLayerRotatePointerDown(e, id);
                }}
            />
            <line 
                x1={layer.width / 2}
                y1={-2}
                x2={layer.width / 2}
                y2={-14}
                className="stroke-blue-500 stroke-1"
            />
          </>
      )}
    </g>
  );
});

LayerPreview.displayName = "LayerPreview";