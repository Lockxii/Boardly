import type { LinkProviderId } from "@/lib/link-providers";

type EmbeddableProvider = Exclude<LinkProviderId, "generic">;

export function setEmbedPlayerMuted(
  iframe: HTMLIFrameElement,
  provider: EmbeddableProvider,
  muted: boolean,
) {
  const target = iframe.contentWindow;
  if (!target) return;

  if (provider === "youtube") {
    target.postMessage(
      JSON.stringify({ event: "command", func: muted ? "mute" : "unMute", args: [] }),
      "*",
    );
    if (!muted) {
      target.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
        "*",
      );
    }
    return;
  }

  if (provider === "tiktok") {
    target.postMessage({ type: muted ? "mute" : "unMute", "x-tiktok-player": true }, "*");
    return;
  }

  if (provider === "vimeo") {
    target.postMessage({ method: "setMuted", value: muted }, "*");
    if (!muted) {
      target.postMessage({ method: "setVolume", value: 1 }, "*");
    }
  }
}

export function unmuteEmbedPlayer(iframe: HTMLIFrameElement, provider: EmbeddableProvider) {
  setEmbedPlayerMuted(iframe, provider, false);
  // Players sometimes need a second nudge after load.
  window.setTimeout(() => setEmbedPlayerMuted(iframe, provider, false), 250);
  window.setTimeout(() => setEmbedPlayerMuted(iframe, provider, false), 800);
}
