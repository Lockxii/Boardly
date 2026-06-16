import { describe, expect, it } from "vitest";
import {
  tiktokIdFromUrl,
  twitterStatusIdFromUrl,
  vimeoIdFromUrl,
  youtubeIdFromUrl,
} from "./link-media-utils";

describe("youtubeIdFromUrl", () => {
  it("extracts ids from watch, youtu.be, shorts and embed forms", () => {
    expect(youtubeIdFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://www.youtube.com/shorts/abc123")).toBe("abc123");
    expect(youtubeIdFromUrl("https://www.youtube.com/embed/abc123")).toBe("abc123");
  });

  it("returns null for non-youtube or empty input", () => {
    expect(youtubeIdFromUrl("https://example.com")).toBeNull();
    expect(youtubeIdFromUrl(undefined)).toBeNull();
  });
});

describe("other provider id extractors", () => {
  it("tiktok", () => {
    expect(tiktokIdFromUrl("https://www.tiktok.com/@user/video/7123456789")).toBe("7123456789");
    expect(tiktokIdFromUrl("https://www.tiktok.com/@user")).toBeNull();
  });

  it("vimeo", () => {
    expect(vimeoIdFromUrl("https://vimeo.com/76979871")).toBe("76979871");
    expect(vimeoIdFromUrl("https://vimeo.com/channels/staff")).toBeNull();
  });

  it("twitter status", () => {
    expect(twitterStatusIdFromUrl("https://x.com/user/status/1700000000000000000")).toBe("1700000000000000000");
    expect(twitterStatusIdFromUrl("https://x.com/user")).toBeNull();
  });
});
