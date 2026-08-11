import { execFile } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { UPLOADS_ROOT, uploadUrl } from "./uploads";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

/**
 * Transcode an uploaded audio file to a 128kbps MP3 rendition for
 * standard-quality streaming. Returns the public URL of the new file.
 */
export async function transcodeLq(sourceFilename: string): Promise<string> {
  const src = path.join(UPLOADS_ROOT, "audio", sourceFilename);
  const outName = `${crypto.randomBytes(12).toString("hex")}-lq.mp3`;
  const out = path.join(UPLOADS_ROOT, "audio", outName);
  await execFileAsync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", src, "-vn", "-codec:a", "libmp3lame", "-b:a", "128k", out],
    { timeout: 5 * 60_000 },
  );
  return uploadUrl("audio", outName);
}

interface AudioQualityUser {
  isAdmin: boolean;
  userType: string;
  subscriptionPlan: string | null;
}

/** Pro listeners, artists, and admins stream the original (HQ) upload. */
export function hearsHq(user: AudioQualityUser): boolean {
  return (
    user.isAdmin ||
    user.userType === "ARTIST" ||
    user.subscriptionPlan === "listener_pro"
  );
}

/**
 * Swap in the rendition the viewer's plan allows and hide the other URL.
 * Basic listeners get the 128kbps file once it exists; everyone else gets HQ.
 */
export function withAudioForUser<
  T extends { audioFile: string; audioFileLq: string | null },
>(track: T, user: AudioQualityUser): Omit<T, "audioFileLq"> {
  const { audioFileLq, ...rest } = track;
  return {
    ...rest,
    audioFile: !hearsHq(user) && audioFileLq ? audioFileLq : track.audioFile,
  };
}

/** Fire-and-forget LQ transcode; logs instead of failing the upload. */
export function scheduleLqTranscode(
  sourceFilename: string,
  onDone: (url: string) => Promise<void>,
): void {
  transcodeLq(sourceFilename)
    .then(onDone)
    .catch((err) => logger.error({ err, sourceFilename }, "LQ transcode failed"));
}
