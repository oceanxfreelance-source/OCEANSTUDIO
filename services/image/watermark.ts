import { sharp } from "./sharp";

export interface WatermarkSpec {
  text: string;
  opacity: number;
  position: "center" | "bottom-right" | "tiled";
  scale: number;
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** Watermarks apply to browser previews ONLY — never to delivered originals/finals. */
export async function watermarkJpeg(input: Buffer, spec: WatermarkSpec): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const size = Math.max(12, Math.round(Math.min(w, h) * spec.scale));
  const text = escapeXml(spec.text);
  const style = `font-family: 'Helvetica Neue', Arial, sans-serif; font-size:${size}px; font-weight:600; letter-spacing:${size * 0.15}px`;
  let body: string;
  if (spec.position === "tiled") {
    const items: string[] = [];
    const stepX = size * Math.max(6, text.length * 0.9);
    const stepY = size * 5;
    for (let y = -h; y < h * 2; y += stepY)
      for (let x = -w; x < w * 2; x += stepX) items.push(`<text x="${x}" y="${y}" style="${style}">${text}</text>`);
    body = `<g transform="rotate(-30 ${w / 2} ${h / 2})" fill="white" fill-opacity="${spec.opacity}">${items.join("")}</g>`;
  } else if (spec.position === "bottom-right") {
    body = `<text x="${w - size}" y="${h - size}" text-anchor="end" fill="white" fill-opacity="${spec.opacity}" style="${style}">${text}</text>`;
  } else {
    body = `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="white" fill-opacity="${spec.opacity}" style="${style}">${text}</text>`;
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
  return sharp(input).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 85 }).toBuffer();
}
