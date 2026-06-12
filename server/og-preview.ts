function pickMeta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${key}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function pickTitle(html: string) {
  const og = pickMeta(html, "title");
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? "";
}

export async function fetchLinkPreview(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL invalide");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Protocole non supporté");
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "BoardlyBot/1.0 (+https://boardly.app)" },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Impossible de récupérer la page");

  const html = (await res.text()).slice(0, 500_000);
  const title = pickTitle(html) || url.hostname;
  const description = pickMeta(html, "description");
  let image = pickMeta(html, "image");
  if (image && image.startsWith("/")) {
    image = `${url.origin}${image}`;
  }

  return { url: url.toString(), title, description, image };
}
