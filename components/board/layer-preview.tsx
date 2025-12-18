"use client";

import { useStorage } from "@/liveblocks.config";
import { memo, useState, useRef, useEffect } from "react";

interface LayerPreviewProps {
  id: string;
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  onLayerResizePointerDown: (e: React.PointerEvent, initialBounds: { x: number, y: number, width: number, height: number }) => void;
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
        // If point[3] is 1, it's a gap/erased point
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

export const LayerPreview = memo(({ id, onLayerPointerDown, onLayerResizePointerDown, onChange, selectionColor }: LayerPreviewProps) => {
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

  // Wrapper style for Vertical Alignment
  const wrapperStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: justify,
      pointerEvents: "none" // Pass clicks through to group if not editing
  };

  // Editable style (Block display to keep text inline)
  const editableStyle: React.CSSProperties = {
      width: "100%",
      outline: "none",
      border: "none",
      background: "transparent",
      fontFamily: fontFamily,
      fontSize: fontSize,
      textAlign: align,
      color: layer.textColor || (layer.fill ? (parseInt(layer.fill.replace('#', ''), 16) > 0xffffff / 2 ? 'black' : 'white') : 'black'),
      pointerEvents: isEditing ? "auto" : "none",
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      cursor: isEditing ? "text" : "move",
      userSelect: isEditing ? "text" : "none",
      WebkitUserSelect: isEditing ? "text" : "none"
  };

  // Calculate scaling for Path
  let pathScaleX = 1;
  let pathScaleY = 1;
  let isDrawing = false;
  
  if (layer.type === "Path") {
      if (layer.width === 0 || layer.height === 0) {
          isDrawing = true;
          pathScaleX = 1;
          pathScaleY = 1;
      } else if (layer.points && layer.points.length > 0) {
          // Calculate original bounds from points
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

  return (
    <g
      onPointerDown={(e) => onLayerPointerDown(e, id)}
      onDoubleClick={handleDoubleClick}
      style={{
        transform: `translate(${layer.x}px, ${layer.y}px)`,
      }}
    >
      {layer.type === "Path" && (
          <path
              d={getSvgPathFromPoints(layer.points || [])}
              stroke={isDrawing ? "#9ca3af" : (layer.fill || "#000")} // Gray-400 for preview
              strokeWidth={layer.strokeWidth || 2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={isDrawing ? 0.5 : 1}
              transform={`scale(${pathScaleX}, ${pathScaleY})`}
              style={{ transformOrigin: "top left" }}
          />
      )}
      {layer.type === "Rectangle" && (
         <>
             <rect
                width={layer.width}
                height={layer.height}
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
                style={{ backgroundColor: layer.fill ? layer.fill : "#fef3c7" }}
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
        <image 
            href={layer.src}
            width={layer.width}
            height={layer.height}
            preserveAspectRatio="none"
        />
      )}

      {/* Unified Selection Border */}
      {isSelected && (
          <>
            <rect
                className="stroke-blue-500 stroke-2 fill-transparent pointer-events-none"
                x={0}
                y={0}
                width={layer.width}
                height={layer.height}
            />
             {/* Resize Handle (Bottom Right) */}
             <rect
                className="fill-white stroke-blue-500 stroke-1 cursor-nwse-resize"
                x={layer.width - 8}
                y={layer.height - 8}
                width={8}
                height={8}
                onPointerDown={(e) => {
                    e.stopPropagation(); 
                    onLayerResizePointerDown(e, { x: layer.x, y: layer.y, width: layer.width, height: layer.height });
                }}
            />
          </>
      )}
    </g>
  );
});

LayerPreview.displayName = "LayerPreview";
