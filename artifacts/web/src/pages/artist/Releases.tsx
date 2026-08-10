import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiGet, apiSend, ApiError, type Track } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { usePlayer } from "@/lib/player";
import { Cover, EmptyState, Modal, Spinner, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, Play, Disc3, Search } from "lucide-react";

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "plays", label: "Most Plays" },
  { id: "az", label: "A–Z" },
  { id: "za", label: "Z–A" },
];

export default function ArtistReleases() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { playTrack } = usePlayer();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [editing, setEditing] = useState<Track | null>(null);
  const [editForm, setEditForm] = useState({ trackName: "", genre: "", releaseDate: "", isPublished: false });
  const [deleteTarget, setDeleteTarget] = useState<Track | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tracks", "mine"],
    queryFn: () => apiGet("/tracks/mine"),
  });

  const tracks: Track[] = useMemo(() => {
    let list: Track[] = [...(data?.tracks ?? [])];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.trackName.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q),
      );
    }
    switch (sort) {
      case "oldest":
        list.sort((a, b) => +new Date(a.releaseDate) - +new Date(b.releaseDate));
        break;
      case "plays":
        list.sort((a, b) => b.playCount - a.playCount);
        break;
      case "az":
        list.sort((a, b) => a.trackName.localeCompare(b.trackName));
        break;
      case "za":
        list.sort((a, b) => b.trackName.localeCompare(a.trackName));
        break;
      default:
        list.sort((a, b) => +new Date(b.releaseDate) - +new Date(a.releaseDate));
    }
    return list;
  }, [data, search, sort]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tracks"] });

  const save = useMutation({
    mutationFn: () =>
      apiSend("PATCH", `/tracks/${editing!.id}`, {
        trackName: editForm.trackName,
        genre: editForm.genre,
        releaseDate: editForm.releaseDate,
        isPublished: editForm.isPublished,
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast("Track updated");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Update failed", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiSend("DELETE", `/tracks/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
      toast("Track deleted");
    },
  });

  const togglePublish = useMutation({
    mutationFn: (t: Track) =>
      apiSend("PATCH", `/tracks/${t.id}`, { isPublished: !t.isPublished }),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-[32px] font-bold gradient-text">My Releases</h1>
        <Link href="/artist/upload" className="btn btn-primary">
          <Plus size={16} /> Upload New Track
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt3" />
          <input
            className="input !h-11 !pl-10"
            placeholder="Search by name or genre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select !h-11 w-44" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner center />
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={<Disc3 size={40} />}
          title={search ? "No tracks match your search" : "No releases yet"}
          subtitle={search ? "Try a different search." : "Upload your first track to get started."}
          action={
            !search && (
              <Link href="/artist/upload" className="btn btn-primary">
                <Plus size={16} /> Upload Track
              </Link>
            )
          }
        />
      ) : (
        <div className="card !p-0 divide-y divide-line">
          {tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] group flex-wrap">
              <Cover src={t.coverArt} name={t.trackName} size={48} />
              <div className="flex-1 min-w-40">
                <p className="font-semibold">{t.trackName}</p>
                <p className="text-txt3 text-sm">
                  {t.genre} · {formatDate(t.releaseDate)} · {t.playCount.toLocaleString()} plays
                </p>
              </div>
              <button
                className="cursor-pointer"
                onClick={() => togglePublish.mutate(t)}
                title={t.isPublished ? "Unpublish" : "Publish"}
              >
                <StatusBadge status={t.isPublished ? "PUBLISHED" : "DRAFT"} />
              </button>
              <div className="flex gap-1.5">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => playTrack(t, tracks)}
                  aria-label="Play"
                >
                  <Play size={14} />
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEditing(t);
                    setEditForm({
                      trackName: t.trackName,
                      genre: t.genre,
                      releaseDate: new Date(t.releaseDate).toISOString().slice(0, 10),
                      isPublished: t.isPublished,
                    });
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm !text-red"
                  onClick={() => setDeleteTarget(t)}
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit track">
        <div className="space-y-4">
          <div>
            <label className="label">Track name</label>
            <input
              className="input"
              value={editForm.trackName}
              onChange={(e) => setEditForm({ ...editForm, trackName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Genre</label>
              <input
                className="input"
                value={editForm.genre}
                onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Release date</label>
              <input
                className="input"
                type="date"
                value={editForm.releaseDate}
                onChange={(e) => setEditForm({ ...editForm, releaseDate: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.isPublished}
              onChange={(e) => setEditForm({ ...editForm, isPublished: e.target.checked })}
              className="w-5 h-5 accent-[#00D4FF]"
            />
            <span className="text-txt2 text-sm">Published</span>
          </label>
          <button
            className="btn btn-primary w-full"
            disabled={!editForm.trackName.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            Save Changes
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete track?"
      >
        <p className="text-txt2 text-sm mb-5">
          <b>{deleteTarget?.trackName}</b> and its play history will be permanently deleted.
          This can't be undone.
        </p>
        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button
            className="btn btn-danger flex-1"
            onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
          >
            Delete Track
          </button>
        </div>
      </Modal>
    </div>
  );
}
