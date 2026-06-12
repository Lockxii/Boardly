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
  | "Star"
  | "Line"
  | "Frame"
  | "Link"
  | "Column";

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type LayerComment = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
};

export type LayerReaction = {
  emoji: string;
  userIds: string[];
};

export type TrashEntry = {
  id: string;
  deletedAt: number;
  layerIds: string[];
  layers: Record<string, Layer>;
};

export type ConnectionLineStyle = "solid" | "dashed" | "dotted";
export type ConnectionMarker = "none" | "arrow" | "dot";
export type ConnectionRouting = "bezier" | "straight";

export type BoardConnection = {
  id: string;
  fromId: string;
  toId: string;
  stroke?: string;
  strokeWidth?: number;
  lineStyle?: ConnectionLineStyle;
  arrowStart?: ConnectionMarker;
  arrowEnd?: ConnectionMarker;
  routing?: ConnectionRouting;
};

export type CanvasVersion = {
  id: string;
  label: string;
  createdAt: number;
  layers: Record<string, Layer>;
  layerIds: string[];
  connections: BoardConnection[];
};

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
  url?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkImage?: string;
  linkProvider?: "youtube" | "spotify" | "tiktok" | "soundcloud" | "vimeo" | "generic";
  linkAuthor?: string;
  linkImageWidth?: number;
  linkImageHeight?: number;
  checklist?: ChecklistItem[];
  groupId?: string;
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
  connections?: BoardConnection[];
  versions?: CanvasVersion[];
  layerComments?: Record<string, LayerComment[]>;
  reactions?: Record<string, LayerReaction[]>;
  trash?: TrashEntry[];
  brandColors?: string[];
};

export type Board = {
  id: string;
  title: string;
  template: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string | null;
  folder?: string | null;
  tags?: string[];
  isPublic?: boolean;
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

export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string;
  provider?: "youtube" | "spotify" | "tiktok" | "soundcloud" | "vimeo" | "generic";
  author?: string;
  imageWidth?: number;
  imageHeight?: number;
};
