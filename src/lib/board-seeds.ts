import { nanoid } from "nanoid";
import type { BoardCanvasData, Layer } from "@/lib/types";

function note(x: number, y: number, text: string, fill = "#FEF3C7", w = 200, h = 140): [string, Layer] {
  const id = nanoid();
  return [id, { type: "Note", x, y, width: w, height: h, fill, value: text, cornerRadius: 8 }];
}

function frame(x: number, y: number, w: number, h: number, label: string, type: "Frame" | "Column" = "Frame"): [string, Layer] {
  const id = nanoid();
  return [id, {
    type: type === "Column" ? "Column" : "Frame",
    x, y, width: w, height: h,
    fill: "transparent",
    stroke: "#94A3B8",
    strokeWidth: 2,
    cornerRadius: 12,
    value: label,
  }];
}

function text(x: number, y: number, content: string, size = 18): [string, Layer] {
  const id = nanoid();
  return [id, { type: "Text", x, y, width: 280, height: 40, fill: "#111827", value: content, fontSize: size, textColor: "#111827" }];
}

export function buildTemplateCanvas(template: string): Partial<BoardCanvasData> | null {
  const layers: Record<string, Layer> = {};
  const layerIds: string[] = [];

  const add = (entry: [string, Layer]) => {
    layers[entry[0]] = entry[1];
    layerIds.push(entry[0]);
  };

  if (template === "moodboard") {
    add(frame(40, 40, 920, 520, "Moodboard"));
    add(note(80, 100, "<b>Inspiration</b><br/>Glissez images & liens ici", "#FECACA"));
    add(note(320, 100, "<b>Palette</b><br/>Couleurs du projet", "#BFDBFE"));
    add(note(560, 100, "<b>Textures</b><br/>Matériaux, typos", "#BBF7D0"));
    add(note(800, 100, "<b>Références</b><br/>Liens web", "#E9D5FF", 140, 140));
    add(text(80, 480, "Brief · Ambiance · Direction artistique", 14));
  } else if (template === "storyboard") {
    add(frame(40, 40, 920, 520, "Storyboard"));
    for (let i = 0; i < 4; i++) {
      add(frame(60 + i * 220, 90, 200, 160, `Scène ${i + 1}`));
      add(note(70 + i * 220, 270, "Description / dialogue", "#FEF3C7", 180, 100));
    }
  } else if (template === "brief") {
    add(frame(40, 40, 920, 560, "Brief client"));
    add(text(60, 70, "Projet", 22));
    add(note(60, 120, "<b>Client</b><br/><br/><b>Objectif</b><br/><br/><b>Deadline</b>", "#FEF3C7", 400, 200));
    add(note(500, 120, "<b>Livrables</b><br/>- <br/>- <br/>- ", "#BFDBFE", 420, 200));
    add(note(60, 350, "<b>Contraintes</b><br/>Budget · Ton · Cibles", "#FECACA", 400, 180));
    add(note(500, 350, "<b>Références</b><br/>Liens & visuels", "#E9D5FF", 420, 180));
  } else if (template === "columns") {
    const cols = ["Idées", "En cours", "Terminé"];
    cols.forEach((label, i) => {
      add(frame(40 + i * 320, 40, 300, 560, label, "Column"));
      add(note(60 + i * 320, 100, "Ajouter une carte…", "#FEF3C7", 260, 120));
    });
  } else {
    return null;
  }

  return { layers, layerIds, connections: [], layerComments: {}, reactions: {}, trash: [], brandColors: ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"] };
}
