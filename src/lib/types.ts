export type LayerType =
  | "Rectangle"
  | "Ellipse"
  | "Text"
  | "Note"
  | "Image"
  | "Path"
  | "Triangle"
  | "Arrow"
  | "Diamond"
  | "Star";

export type Color = { r: number; g: number; b: number };

export type Layer = {
  type: LayerType;
  x: number;
  y: number;
  height: number;
  width: number;
  fill: string;
  stroke?: string;
  points?: number[][];
  strokeWidth?: number;
  value?: string;
  src?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  alignX?: "left" | "center" | "right";
  alignY?: "top" | "center" | "bottom";
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: "none" | "underline";
  textBackground?: string;
  cornerRadius?: number;
  rotation?: number;
  locked?: boolean;
};

export type Presence = {
  cursor: { x: number; y: number } | null;
  selection: string[];
};

export type AuditEntry = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  layerType: string;
  timestamp: number;
};

export type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  attachment?: { type: "image" | "file"; url: string; name: string };
  linkedLayerIds?: string[];
};

// Liveblocks types removed — using pure Zustand store now.

export type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type BoardCanvasData = {
  layers: Record<string, Layer>;
  layerIds: string[];
  auditLog: AuditEntry[];
  chatMessages: ChatMessage[];
};

export type Board = {
  id: string;
  title: string;
  template: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string | null;
  role?: "owner" | "editor";
  isOwner?: boolean;
  authorName?: string | null;
};

export type BoardMember = {
  id: string;
  boardId: string;
  email: string;
  role: string;
  createdAt: string;
};
