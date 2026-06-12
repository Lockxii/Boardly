import { nanoid } from "nanoid";

type Layer = {
  type: string;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  value?: string;
  cornerRadius?: number;
  fontSize?: number;
  textColor?: string;
};

export function buildTemplateCanvas(template: string) {
  const layers: Record<string, Layer> = {};
  const layerIds: string[] = [];

  const add = (layer: Layer) => {
    const id = nanoid();
    layers[id] = layer;
    layerIds.push(id);
  };

  if (template === "moodboard") {
    add({ type: "Frame", x: 40, y: 40, width: 920, height: 520, fill: "transparent", stroke: "#94A3B8", strokeWidth: 2, cornerRadius: 12, value: "Moodboard" });
    add({ type: "Note", x: 80, y: 100, width: 200, height: 140, fill: "#FECACA", value: "<b>Inspiration</b><br/>Glissez images & liens ici", cornerRadius: 8 });
    add({ type: "Note", x: 320, y: 100, width: 200, height: 140, fill: "#BFDBFE", value: "<b>Palette</b><br/>Couleurs du projet", cornerRadius: 8 });
    add({ type: "Note", x: 560, y: 100, width: 200, height: 140, fill: "#BBF7D0", value: "<b>Textures</b><br/>Matériaux, typos", cornerRadius: 8 });
    add({ type: "Note", x: 800, y: 100, width: 140, height: 140, fill: "#E9D5FF", value: "<b>Références</b>", cornerRadius: 8 });
  } else if (template === "storyboard") {
    add({ type: "Frame", x: 40, y: 40, width: 920, height: 520, fill: "transparent", stroke: "#94A3B8", strokeWidth: 2, cornerRadius: 12, value: "Storyboard" });
    for (let i = 0; i < 4; i++) {
      add({ type: "Frame", x: 60 + i * 220, y: 90, width: 200, height: 160, fill: "transparent", stroke: "#94A3B8", strokeWidth: 2, cornerRadius: 8, value: `Scène ${i + 1}` });
      add({ type: "Note", x: 70 + i * 220, y: 270, width: 180, height: 100, fill: "#FEF3C7", value: "Description / dialogue", cornerRadius: 8 });
    }
  } else if (template === "brief") {
    add({ type: "Frame", x: 40, y: 40, width: 920, height: 560, fill: "transparent", stroke: "#94A3B8", strokeWidth: 2, cornerRadius: 12, value: "Brief client" });
    add({ type: "Text", x: 60, y: 70, width: 280, height: 40, fill: "#111827", value: "Projet", fontSize: 22, textColor: "#111827" });
    add({ type: "Note", x: 60, y: 120, width: 400, height: 200, fill: "#FEF3C7", value: "<b>Client</b><br/><br/><b>Objectif</b><br/><br/><b>Deadline</b>", cornerRadius: 8 });
    add({ type: "Note", x: 500, y: 120, width: 420, height: 200, fill: "#BFDBFE", value: "<b>Livrables</b><br/>- <br/>- ", cornerRadius: 8 });
  } else if (template === "columns") {
    ["Idées", "En cours", "Terminé"].forEach((label, i) => {
      add({ type: "Column", x: 40 + i * 320, y: 40, width: 300, height: 560, fill: "transparent", stroke: "#94A3B8", strokeWidth: 2, cornerRadius: 12, value: label });
      add({ type: "Note", x: 60 + i * 320, y: 100, width: 260, height: 120, fill: "#FEF3C7", value: "Ajouter une carte…", cornerRadius: 8 });
    });
  } else {
    return null;
  }

  return {
    layers,
    layerIds,
    connections: [],
    layerComments: {},
    reactions: {},
    trash: [],
    brandColors: ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"],
    auditLog: [],
    chatMessages: [],
  };
}
