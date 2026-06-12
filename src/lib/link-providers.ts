export const LINK_PROVIDER_VALUES = [
  "youtube",
  "spotify",
  "tiktok",
  "soundcloud",
  "vimeo",
  "apple-music",
  "deezer",
  "amazon-music",
  "generic",
] as const;

export type LinkProviderId = (typeof LINK_PROVIDER_VALUES)[number];
export type LinkProvider = Exclude<LinkProviderId, "generic">;

export function normalizeLinkHost(hostname: string) {
  return hostname.replace(/^www\./, "").replace(/^m\./, "");
}

export function detectLinkProviderFromUrl(rawUrl: string): LinkProviderId {
  try {
    const url = new URL(rawUrl);
    const host = normalizeLinkHost(url.hostname);

    if (host === "youtube.com" || host === "youtu.be") return "youtube";
    if (host === "open.spotify.com") return "spotify";
    if (host === "tiktok.com" || host === "vm.tiktok.com") return "tiktok";
    if (host === "soundcloud.com" || host === "on.soundcloud.com") return "soundcloud";
    if (host === "vimeo.com" || host === "player.vimeo.com") return "vimeo";
    if (host === "music.apple.com") return "apple-music";
    if (host === "deezer.com") return "deezer";
    if (host.includes("music.amazon")) return "amazon-music";

    return "generic";
  } catch {
    return "generic";
  }
}

export function isMusicLinkProvider(provider?: LinkProviderId) {
  return provider === "spotify" || provider === "apple-music" || provider === "deezer" || provider === "amazon-music" || provider === "soundcloud";
}

export function cleanMusicLinkTitle(title: string, provider: LinkProviderId) {
  if (provider === "apple-music") {
    return title
      .replace(/\s+(-|–|—)\s+Apple Music.*$/i, "")
      .replace(/\s+sur Apple Music.*$/i, "")
      .replace(/\s+on Apple Music.*$/i, "")
      .trim();
  }
  if (provider === "spotify") {
    return title.replace(/\s+\|\s+Spotify.*$/i, "").trim();
  }
  if (provider === "deezer") {
    return title.replace(/\s+\|\s+Deezer.*$/i, "").replace(/\s+-\s+Deezer.*$/i, "").trim();
  }
  if (provider === "amazon-music") {
    return title.replace(/\s+\|\s+Amazon Music.*$/i, "").replace(/\s+on Amazon Music.*$/i, "").trim();
  }
  return title;
}
