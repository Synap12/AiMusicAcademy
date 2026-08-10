import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiForm, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { UploadCloud, Music, Image as ImageIcon, Sparkles, CheckCircle2 } from "lucide-react";

/** Read a local audio file's duration so plays can compute listen time. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

function prettySize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function ArtistUpload() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [trackName, setTrackName] = useState("");
  const [genre, setGenre] = useState("Electronic");
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [publish, setPublish] = useState(true);
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  const coverPreview = useMemo(
    () => (cover ? URL.createObjectURL(cover) : null),
    [cover],
  );
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.set("trackName", trackName);
      fd.set("genre", genre);
      fd.set("releaseDate", releaseDate);
      fd.set("isPublished", String(publish));
      if (audio) {
        fd.set("audio", audio);
        const duration = await readDuration(audio);
        if (duration) fd.set("durationSeconds", String(duration));
      }
      if (cover) fd.set("cover", cover);
      return apiForm("POST", "/tracks", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracks"] });
      toast(publish ? "Track published!" : "Track saved as draft");
      navigate("/artist/releases");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Upload failed", "error"),
  });

  return (
    <div className="max-w-5xl">
      <h1 className="text-[32px] font-bold gradient-text mb-2">Upload Audio</h1>
      <p className="text-txt2 mb-7">Add a new track to your catalog.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* left: files */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Music size={18} className="text-cyan" /> Audio File
            </h2>
            <label className="border-2 border-dashed border-line rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-cyan transition-colors bg-bg">
              {audio ? (
                <>
                  <CheckCircle2 size={30} className="text-green" />
                  <span className="text-sm font-semibold text-center break-all">{audio.name}</span>
                  <span className="text-txt3 text-xs">
                    {prettySize(audio.size)} — click to replace
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud size={30} className="text-cyan" />
                  <span className="text-sm text-txt2">Click to choose an audio file</span>
                  <span className="text-txt3 text-xs">mp3, wav, or m4a · up to 60 MB</span>
                </>
              )}
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.flac,audio/*"
                className="hidden"
                onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="card">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ImageIcon size={18} className="text-purple" /> Cover Art
              <span className="text-txt3 text-xs font-normal">(optional)</span>
            </h2>
            <div className="flex gap-5 items-start">
              <label className="shrink-0 cursor-pointer group">
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="w-32 h-32 rounded-xl object-cover border border-line group-hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-xl border-2 border-dashed border-line flex flex-col items-center justify-center gap-1.5 text-txt3 group-hover:border-purple transition-colors bg-bg">
                    <ImageIcon size={22} />
                    <span className="text-[11px]">Choose image</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="text-sm text-txt2 space-y-2">
                <p>Square images look best (1:1). PNG, JPG, or SVG up to 10 MB.</p>
                <p className="flex items-start gap-1.5 text-txt3 text-xs">
                  <Sparkles size={14} className="text-purple shrink-0 mt-0.5" />
                  No cover yet? Generate one in the AI Cover Art studio and assign
                  it to this track afterwards.
                </p>
                {cover && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCover(null)}
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* right: details + submit */}
        <div className="card space-y-5">
          <h2 className="font-bold text-lg">Track Details</h2>
          <div>
            <label className="label">Track name</label>
            <input
              className="input"
              value={trackName}
              maxLength={120}
              onChange={(e) => setTrackName(e.target.value)}
              placeholder="e.g. Midnight Circuit"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Genre</label>
              <select className="select" value={genre} onChange={(e) => setGenre(e.target.value)}>
                {["Electronic", "Hip-Hop", "Rock", "R&B", "Jazz", "Classical", "Ambient", "Pop", "Lo-Fi", "Other"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Release date</label>
              <input
                className="input"
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer border border-line rounded-xl px-4 py-3.5">
            <div>
              <p className="font-semibold text-sm">Publish immediately</p>
              <p className="text-txt3 text-xs">
                {publish
                  ? "Listeners can stream this track right away."
                  : "Saved as a draft — publish later from My Releases."}
              </p>
            </div>
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="w-5 h-5 accent-[#00D4FF] shrink-0"
            />
          </label>

          <button
            className="btn btn-primary w-full !py-4"
            disabled={!trackName.trim() || !audio || upload.isPending}
            onClick={() => upload.mutate()}
          >
            <UploadCloud size={17} />
            {upload.isPending ? "Uploading…" : publish ? "Upload & Publish" : "Save as Draft"}
          </button>
          {!audio && (
            <p className="text-txt3 text-xs text-center">
              Choose an audio file to enable upload.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
