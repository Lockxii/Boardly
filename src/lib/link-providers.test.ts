import { describe, expect, it } from "vitest";
import { cleanMusicLinkTitle, detectLinkProviderFromUrl } from "./link-providers";

describe("detectLinkProviderFromUrl", () => {
  it("detects providers from their hosts (ignoring www/m prefixes)", () => {
    expect(detectLinkProviderFromUrl("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectLinkProviderFromUrl("https://youtu.be/abc")).toBe("youtube");
    expect(detectLinkProviderFromUrl("https://open.spotify.com/track/x")).toBe("spotify");
    expect(detectLinkProviderFromUrl("https://m.tiktok.com/@u/video/1")).toBe("tiktok");
    expect(detectLinkProviderFromUrl("https://x.com/u/status/1")).toBe("twitter");
    expect(detectLinkProviderFromUrl("https://twitter.com/u/status/1")).toBe("twitter");
    expect(detectLinkProviderFromUrl("https://vimeo.com/123")).toBe("vimeo");
    expect(detectLinkProviderFromUrl("https://music.apple.com/fr/album/x/1")).toBe("apple-music");
  });

  it("falls back to generic for unknown hosts and invalid URLs", () => {
    expect(detectLinkProviderFromUrl("https://example.com/page")).toBe("generic");
    expect(detectLinkProviderFromUrl("not a url")).toBe("generic");
  });
});

describe("cleanMusicLinkTitle", () => {
  it("strips provider suffixes", () => {
    expect(cleanMusicLinkTitle("Song - Apple Music", "apple-music")).toBe("Song");
    expect(cleanMusicLinkTitle("Song | Spotify", "spotify")).toBe("Song");
    expect(cleanMusicLinkTitle("Song | Deezer", "deezer")).toBe("Song");
  });

  it("leaves non-music titles untouched", () => {
    expect(cleanMusicLinkTitle("My Page", "generic")).toBe("My Page");
  });
});
