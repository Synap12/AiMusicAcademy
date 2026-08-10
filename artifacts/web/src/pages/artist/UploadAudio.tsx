import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiForm, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { UploadCloud, Music } from "lucide-react";

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
    <div className="max-w-xl">
      <h1 className="text-[32px] font-bold gradient-text mb-6">Upload Audio</h1>
      <div className="card space-y-5">
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

        <div>
          <label className="label">Audio file (mp3 / wav / m4a)</label>
          <label className="card !p-6 border-dashed flex flex-col items-center gap-2 cursor-pointer hover:!border-cyan transition-colors">
            <UploadCloud size={28} className="text-cyan" />
            <span className="text-sm text-txt2">
              {audio ? audio.name : "Click to choose an audio file"}
            </span>
            <input
              type="file"
              accept=".mp3,.wav,.m4a,.ogg,.flac,audio/*"
              className="hidden"
              onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div>
          <label className="label">Cover art (optional)</label>
          <label className="card !p-5 border-dashed flex flex-col items-center gap-2 cursor-pointer hover:!border-purple transition-colors">
            <Music size={24} className="text-purple" />
            <span className="text-sm text-txt2">
              {cover ? cover.name : "Click to choose cover art"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-txt3 text-xs mt-1.5">
            No cover? Generate one in the AI Cover Art studio and assign it later.
          </p>
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

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="w-5 h-5 accent-[#00D4FF]"
          />
          <span className="text-txt2 text-sm">Publish immediately</span>
        </label>

        <button
          className="btn btn-primary w-full"
          disabled={!trackName.trim() || !audio || upload.isPending}
          onClick={() => upload.mutate()}
        >
          {upload.isPending ? "Uploading…" : publish ? "Upload & Publish" : "Save as Draft"}
        </button>
      </div>
    </div>
  );
}
