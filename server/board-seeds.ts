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

  const connections: { id: string; fromId: string; toId: string; arrowEnd?: string; routing?: string }[] = [];
  const add = (layer: Layer) => {
    const id = nanoid();
    layers[id] = layer;
    layerIds.push(id);
    return id;
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
  } else if (template === "kanban") {
    const fills = ["#FEE2E2", "#FEF3C7", "#DCFCE7"];
    ["📋 À faire", "🔧 En cours", "✅ Terminé"].forEach((label, i) => {
      add({ type: "Column", x: 40 + i * 320, y: 40, width: 300, height: 560, fill: "transparent", stroke: "#94A3B8", strokeWidth: 2, cornerRadius: 12, value: label });
      add({ type: "Note", x: 60 + i * 320, y: 100, width: 260, height: 90, fill: fills[i], value: "Nouvelle carte…", cornerRadius: 8 });
      add({ type: "Note", x: 60 + i * 320, y: 210, width: 260, height: 90, fill: fills[i], value: "Nouvelle carte…", cornerRadius: 8 });
    });
  } else if (template === "retro") {
    add({ type: "Text", x: 40, y: 24, width: 400, height: 40, fill: "#111827", value: "Rétrospective", fontSize: 24, textColor: "#111827" });
    const cols = [
      { label: "😀 Continuer", fill: "#DCFCE7" },
      { label: "🔧 Améliorer", fill: "#FEE2E2" },
      { label: "💡 Idées & actions", fill: "#FEF3C7" },
    ];
    cols.forEach((c, i) => {
      add({ type: "Column", x: 40 + i * 320, y: 80, width: 300, height: 520, fill: "transparent", stroke: "#94A3B8", strokeWidth: 2, cornerRadius: 12, value: c.label });
      add({ type: "Note", x: 60 + i * 320, y: 140, width: 260, height: 90, fill: c.fill, value: "…", cornerRadius: 8 });
    });
  } else if (template === "mindmap") {
    const center = add({ type: "Note", x: 420, y: 270, width: 200, height: 96, fill: "#DBEAFE", value: "<b>Idée centrale</b>", cornerRadius: 48 });
    const spokes = [
      { x: 120, y: 80, label: "Branche 1", fill: "#FCE7F3" },
      { x: 760, y: 80, label: "Branche 2", fill: "#DCFCE7" },
      { x: 120, y: 470, label: "Branche 3", fill: "#FEF3C7" },
      { x: 760, y: 470, label: "Branche 4", fill: "#E9D5FF" },
    ];
    for (const s of spokes) {
      const id = add({ type: "Note", x: s.x, y: s.y, width: 180, height: 80, fill: s.fill, value: s.label, cornerRadius: 16 });
      connections.push({ id: nanoid(), fromId: center, toId: id, arrowEnd: "none", routing: "bezier" });
    }
  } else if (template === "flowchart") {
    const start = add({ type: "Note", x: 400, y: 40, width: 240, height: 70, fill: "#DCFCE7", value: "<b>Début</b>", cornerRadius: 40 });
    const step = add({ type: "Note", x: 400, y: 170, width: 240, height: 90, fill: "#DBEAFE", value: "Étape", cornerRadius: 8 });
    const decision = add({ type: "Note", x: 400, y: 320, width: 240, height: 90, fill: "#FEF3C7", value: "Décision ?", cornerRadius: 8 });
    const end = add({ type: "Note", x: 400, y: 470, width: 240, height: 70, fill: "#FEE2E2", value: "<b>Fin</b>", cornerRadius: 40 });
    connections.push(
      { id: nanoid(), fromId: start, toId: step, arrowEnd: "arrow", routing: "straight" },
      { id: nanoid(), fromId: step, toId: decision, arrowEnd: "arrow", routing: "straight" },
      { id: nanoid(), fromId: decision, toId: end, arrowEnd: "arrow", routing: "straight" },
    );
  } else {
    return null;
  }

  return {
    layers,
    layerIds,
    connections,
    layerComments: {},
    reactions: {},
    trash: [],
    brandColors: ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"],
    auditLog: [],
    chatMessages: [],
  };
}
