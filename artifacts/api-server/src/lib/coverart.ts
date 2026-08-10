import crypto from "node:crypto";
import { saveBuffer } from "./uploads";
import { logger } from "./logger";

export function isOpenAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Generate cover art. Uses OpenAI gpt-image-1 when OPENAI_API_KEY is set;
 * otherwise renders a stylized SVG placeholder locally so the feature works
 * end-to-end before keys are provided. Returns the public image URL.
 */
export async function generateCoverArt(
  prompt: string,
  style: string,
): Promise<{ url: string; generator: "openai" | "placeholder" }> {
  if (isOpenAiConfigured()) {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: style ? `${prompt}. Style: ${style}` : prompt,
          size: "1024x1024",
          n: 1,
        }),
      });
      const json: any = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || `OpenAI error ${res.status}`);
      }
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI returned no image data");
      const url = saveBuffer("images", ".png", Buffer.from(b64, "base64"));
      return { url, generator: "openai" };
    } catch (err) {
      logger.error({ err }, "OpenAI image generation failed; using placeholder");
    }
  }
  return { url: placeholderCover(prompt, style), generator: "placeholder" };
}

const STYLE_PALETTES: Record<string, [string, string, string]> = {
  cyberpunk: ["#00D4FF", "#B537FF", "#0a0a1a"],
  vaporwave: ["#FF71CE", "#01CDFE", "#1a0a2a"],
  minimal: ["#FFFFFF", "#333333", "#0a0a0a"],
  abstract: ["#00FF88", "#00D4FF", "#0a1a12"],
  retro: ["#FFA500", "#FF4444", "#1a120a"],
  dark: ["#B537FF", "#1a1a1a", "#000000"],
};

function placeholderCover(prompt: string, style: string): string {
  const hash = crypto.createHash("sha256").update(prompt + style).digest();
  const palette =
    STYLE_PALETTES[style.toLowerCase()] ??
    Object.values(STYLE_PALETTES)[hash[0] % Object.keys(STYLE_PALETTES).length];
  const [c1, c2, bg] = palette;
  const angle = hash[1] % 360;
  const shapes: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = (hash[i * 3 + 2] / 255) * 1024;
    const y = (hash[i * 3 + 3] / 255) * 1024;
    const r = 60 + (hash[i * 3 + 4] / 255) * 240;
    const color = i % 2 === 0 ? c1 : c2;
    const opacity = 0.12 + (hash[i + 10] / 255) * 0.3;
    shapes.push(
      `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`,
    );
  }
  const title = prompt
    .slice(0, 42)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0.55"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="1024" height="1024" fill="${bg}"/>
  <g filter="url(#blur)">${shapes.join("")}</g>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <text x="64" y="920" font-family="Inter, sans-serif" font-size="44" font-weight="700" fill="#FFFFFF" opacity="0.9">${title}</text>
  <text x="64" y="972" font-family="Inter, sans-serif" font-size="26" fill="#FFFFFF" opacity="0.55">AI MUSIC ACADEMY</text>
</svg>`;
  return saveBuffer("images", ".svg", Buffer.from(svg, "utf8"));
}
