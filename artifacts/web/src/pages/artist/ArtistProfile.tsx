import { useMutation } from "@tanstack/react-query";
import Profile from "../listener/Profile";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiForm } from "@/lib/api";
import { Camera } from "lucide-react";

/** Artist profile = shared settings page + cover image + artist extras. */
export default function ArtistProfile() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();

  const uploadCover = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.set("image", file);
      return apiForm("POST", "/users/me/cover", form);
    },
    onSuccess: () => {
      refresh();
      toast("Cover image updated");
    },
    onError: () => toast("Cover upload failed", "error"),
  });

  return (
    <div>
      <div
        className="relative rounded-2xl h-40 md:h-52 bg-card border border-line bg-cover bg-center mb-8 max-w-2xl"
        style={
          user?.coverImage
            ? { backgroundImage: `url(${user.coverImage})` }
            : { background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(181,55,255,0.25))" }
        }
      >
        <label className="absolute bottom-3 right-3 btn btn-secondary btn-sm cursor-pointer">
          <Camera size={14} /> Change Cover
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadCover.mutate(f);
            }}
          />
        </label>
      </div>
      <Profile artistExtras />
    </div>
  );
}
