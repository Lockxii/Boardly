export type RemotePresence = {
  connectionId: string;
  userId: string;
  userName: string;
  cursorX: number | null;
  cursorY: number | null;
};

const CURSOR_COLORS = ["#2563EB", "#DC2626", "#16A34A", "#D97706", "#9333EA", "#0891B2", "#DB2777"];

export function cursorColorForUser(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
