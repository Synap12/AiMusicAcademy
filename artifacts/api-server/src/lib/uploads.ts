import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

/** Walk up from cwd to the workspace root so uploads live in one stable place. */
function defaultUploadsDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.join(dir, "uploads");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), "uploads");
}

export const UPLOADS_ROOT = path.resolve(
  process.env.UPLOADS_DIR || defaultUploadsDir(),
);

for (const sub of ["audio", "images"]) {
  fs.mkdirSync(path.join(UPLOADS_ROOT, sub), { recursive: true });
}

const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac"]);
// SVG is intentionally excluded: it can carry inline <script>, and uploads are
// served from the app's own origin, which would make it a stored-XSS vector.
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function storageFor(subFor: (file: Express.Multer.File) => "audio" | "images") {
  return multer.diskStorage({
    destination: (_req, file, cb) =>
      cb(null, path.join(UPLOADS_ROOT, subFor(file))),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".bin";
      cb(null, `${crypto.randomBytes(12).toString("hex")}${ext}`);
    },
  });
}

// Track uploads carry both an audio file and an optional cover image, so the
// destination must follow the field, not the upload kind.
export const audioUpload = multer({
  storage: storageFor((file) => (file.fieldname === "audio" ? "audio" : "images")),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === "audio" && !AUDIO_EXT.has(ext)) {
      cb(new Error("Audio must be mp3, wav, m4a, ogg, or flac"));
    } else if (file.fieldname !== "audio" && !IMAGE_EXT.has(ext)) {
      cb(new Error("Cover art must be an image file"));
    } else {
      cb(null, true);
    }
  },
});

export const imageUpload = multer({
  storage: storageFor(() => "images"),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_EXT.has(ext)) cb(new Error("File must be an image"));
    else cb(null, true);
  },
});

/** Public URL for a stored upload. */
export function uploadUrl(sub: "audio" | "images", filename: string): string {
  return `/uploads/${sub}/${filename}`;
}

/** Write a raw buffer into the uploads dir and return its public URL. */
export function saveBuffer(
  sub: "audio" | "images",
  ext: string,
  buf: Buffer,
): string {
  const name = `${crypto.randomBytes(12).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_ROOT, sub, name), buf);
  return uploadUrl(sub, name);
}
