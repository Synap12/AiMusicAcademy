import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, ApiError, type Track } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Cover, Modal, Spinner } from "@/components/ui";
import { Sparkles, Trash2, Download, Disc3 } from "lucide-react";
import clsx from "clsx";

const STYLES = ["cyberpunk", "vaporwave", "minimal", "abstract", "retro", "dark"];

interface Art {
  id: number;
  image: string;
  prompt: string;
  style: string;
  createdAt: string;
}

export default function ArtistCoverArt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cyberpunk");
  const [preview, setPreview] = useState<Art | null>(null);
  const [assignTarget, setAssignTarget] = useState<Art | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cover-art"],
    queryFn: () => apiGet("/artist/cover-art"),
  });
  const { data: myTracks } = useQuery({
    queryKey: ["tracks", "mine"],
    queryFn: () => apiGet("/tracks/mine"),
    enabled: assignTarget !== null,
  });

  const generate = useMutation({
    mutationFn: () => apiSend("POST", "/artist/cover-art", { prompt, style }),
    onSuccess: (res) => {
      setPreview(res.art);
      qc.invalidateQueries({ queryKey: ["cover-art"] });
      toast(
        res.generator === "openai"
          ? "Cover generated with AI"
          : "Cover generated (add an OpenAI key for full AI images)",
      );
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Generation failed", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiSend("DELETE", `/artist/cover-art/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cover-art"] });
      setPreview(null);
      toast("Cover deleted");
    },
  });

  const assign = useMutation({
    mutationFn: ({ artId, trackId }: { artId: number; trackId: number }) =>
      apiSend("POST", `/artist/cover-art/${artId}/assign`, { trackId }),
    onSuccess: () => {
      setAssignTarget(null);
      qc.invalidateQueries({ queryKey: ["tracks"] });
      toast("Cover assigned to track");
    },
  });

  const gallery: Art[] = data?.gallery ?? [];
  // limit === null means unlimited (admin).
  const usage: { used: number; limit: number | null } = data?.usage ?? { used: 0, limit: 0 };
  const atLimit = data !== undefined && usage.limit !== null && usage.used >= usage.limit;

  return (
    <div>
      <h1 className="text-[32px] font-bold gradient-text mb-2">AI Cover Art</h1>
      <p className="text-txt2 mb-7">
        Generate cover art for your releases
        {data && !data.openaiConfigured && " — running in placeholder mode until an OpenAI key is added"}
        .
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Generator</h2>
            {data && usage.limit !== null && (
              <span className={clsx("text-sm font-semibold", atLimit ? "text-red" : "text-txt2")}>
                {usage.used} / {usage.limit} this month
              </span>
            )}
          </div>
          {atLimit && (
            <div className="mb-4 rounded-lg border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
              You've used all {usage.limit} AI cover generations for this month. Your
              quota resets on the 1st.
            </div>
          )}
          <label className="label">Describe your cover</label>
          <textarea
            className="textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A neon-lit city skyline dissolving into sound waves…"
          />
          <label className="label mt-4">Style</label>
          <div className="flex gap-2 flex-wrap">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={clsx(
                  "px-3.5 py-1.5 rounded-full text-sm font-semibold border capitalize transition-colors",
                  style === s
                    ? "gradient-bg text-white border-transparent"
                    : "border-line text-txt2 hover:text-txt",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary w-full mt-6"
            disabled={prompt.trim().length < 3 || generate.isPending || atLimit}
            onClick={() => generate.mutate()}
          >
            <Sparkles size={16} />
            {generate.isPending ? "Generating…" : "Generate Cover"}
          </button>
        </div>

        <div className="card flex flex-col items-center justify-center">
          {generate.isPending ? (
            <Spinner />
          ) : preview ? (
            <>
              <img src={preview.image} alt={preview.prompt} className="rounded-xl w-full max-w-xs aspect-square object-cover" />
              <div className="flex gap-2 mt-4">
                <a href={preview.image} download className="btn btn-secondary btn-sm">
                  <Download size={14} /> Download
                </a>
                <button className="btn btn-secondary btn-sm" onClick={() => setAssignTarget(preview)}>
                  <Disc3 size={14} /> Assign to Track
                </button>
                <button className="btn btn-ghost btn-sm !text-red" onClick={() => remove.mutate(preview.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          ) : (
            <p className="text-txt3 text-sm">Your generated cover will appear here.</p>
          )}
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Gallery</h2>
      {isLoading ? (
        <Spinner center />
      ) : gallery.length === 0 ? (
        <p className="text-txt3">No saved covers yet — generate your first one above.</p>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
        >
          {gallery.map((g) => (
            <div key={g.id} className="card !p-3 group">
              <img
                src={g.image}
                alt={g.prompt}
                className="rounded-lg w-full aspect-square object-cover cursor-pointer"
                onClick={() => setPreview(g)}
              />
              <p className="text-txt3 text-xs truncate mt-2" title={g.prompt}>
                {g.prompt}
              </p>
              <div className="flex gap-1.5 mt-2">
                <button
                  className="btn btn-ghost btn-sm flex-1 !py-1.5"
                  onClick={() => setAssignTarget(g)}
                >
                  <Disc3 size={12} /> Assign
                </button>
                <button
                  className="btn btn-ghost btn-sm !py-1.5 !text-red"
                  onClick={() => remove.mutate(g.id)}
                  aria-label="Delete cover"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        title="Assign cover to a track"
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {(myTracks?.tracks ?? []).length === 0 && (
            <p className="text-txt3 text-sm">You haven't uploaded any tracks yet.</p>
          )}
          {(myTracks?.tracks ?? []).map((t: Track) => (
            <button
              key={t.id}
              className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-white/5"
              onClick={() =>
                assignTarget && assign.mutate({ artId: assignTarget.id, trackId: t.id })
              }
            >
              <Cover src={t.coverArt} name={t.trackName} size={40} />
              <div>
                <p className="font-semibold text-sm">{t.trackName}</p>
                <p className="text-txt3 text-xs">{t.genre}</p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
