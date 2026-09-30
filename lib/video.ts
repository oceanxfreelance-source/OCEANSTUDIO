/**
 * Turn a pasted video link into something we can show.
 * - YouTube / Vimeo → privacy-friendly embed URL (loaded only when clicked)
 * - direct .mp4/.webm/.mov → <video> source
 * - anything else (Instagram, Drive…) → plain external link
 */
export type VideoSource =
  | { kind: "youtube"; id: string; embedUrl: string; thumbnail: string }
  | { kind: "vimeo"; id: string; embedUrl: string }
  | { kind: "file"; url: string }
  | { kind: "link"; url: string };

export function parseVideoUrl(raw: string | null | undefined): VideoSource | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  let yt: string | null = null;
  if (host === "youtu.be") yt = url.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") yt = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      yt = m?.[1] ?? null;
    }
  }
  if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) {
    return {
      kind: "youtube",
      id: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1`,
      thumbnail: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(\d{6,12})/);
    if (m) return { kind: "vimeo", id: m[1]!, embedUrl: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1` };
  }

  if (/\.(mp4|webm|mov|m4v)$/i.test(url.pathname)) return { kind: "file", url: url.toString() };
  return { kind: "link", url: url.toString() };
}
