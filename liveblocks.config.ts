import { createClient, LiveList, LiveMap, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

export type LayerType = "Rectangle" | "Ellipse" | "Text" | "Note" | "Image" | "Path" | "Triangle" | "Arrow" | "Diamond" | "Star";

export type Color = {
    r: number;
    g: number;
    b: number;
};

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
  // Alignment
  alignX?: "left" | "center" | "right";
  alignY?: "top" | "center" | "bottom";
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: "none" | "underline";
  cornerRadius?: number;
  rotation?: number;
};

export type Presence = {
  cursor: { x: number; y: number } | null;
  selection: string[];
};

export type Storage = {
  layers: LiveMap<string, LiveObject<Layer>>;
  layerIds: LiveList<string>;
};

export const {
  RoomProvider,
  useMyPresence,
  useStorage,
  useMutation,
  useOthers,
  useSelf,
  useHistory,
  useCanUndo,
  useCanRedo
} = createRoomContext<Presence, Storage>(client);
