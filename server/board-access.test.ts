import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma client so the access-control logic can be tested in isolation.
vi.mock("./prisma.js", () => ({
  prisma: {
    board: { findUnique: vi.fn() },
    boardMember: { findFirst: vi.fn() },
  },
}));

import { prisma } from "./prisma.js";
import { getBoardAccess } from "./board-access.js";

const findUnique = prisma.board.findUnique as unknown as ReturnType<typeof vi.fn>;
const findFirst = prisma.boardMember.findFirst as unknown as ReturnType<typeof vi.fn>;

const user = { id: "user-1", email: "user@example.com" };

describe("getBoardAccess — the core authorization boundary", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
  });

  it("returns null for a non-existent board", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getBoardAccess("nope", user)).toBeNull();
  });

  it("grants owner access when the board author matches", async () => {
    findUnique.mockResolvedValue({ id: "b1", authorId: "user-1" });
    const access = await getBoardAccess("b1", user);
    expect(access).toMatchObject({ role: "owner", isOwner: true });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("grants editor access to a shared member (matched by email)", async () => {
    findUnique.mockResolvedValue({ id: "b1", authorId: "someone-else" });
    findFirst.mockResolvedValue({ id: "m1", email: "user@example.com", role: "editor" });
    const access = await getBoardAccess("b1", user);
    expect(access).toMatchObject({ role: "editor", isOwner: false });
    expect(findFirst).toHaveBeenCalledWith({
      where: { boardId: "b1", email: "user@example.com" },
    });
  });

  it("denies access to a non-owner, non-member", async () => {
    findUnique.mockResolvedValue({ id: "b1", authorId: "someone-else" });
    findFirst.mockResolvedValue(null);
    expect(await getBoardAccess("b1", user)).toBeNull();
  });
});
