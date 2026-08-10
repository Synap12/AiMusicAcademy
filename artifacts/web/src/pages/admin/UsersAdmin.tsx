import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Avatar, Spinner, StatusBadge } from "@/components/ui";
import { planLabel } from "@/lib/format";
import { Search } from "lucide-react";

interface AdminUser {
  id: number;
  email: string;
  artistName: string;
  profileImage: string | null;
  userType: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  isAdmin: boolean;
  isBanned: boolean;
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, type],
    queryFn: () =>
      apiGet(`/admin/users?search=${encodeURIComponent(search)}&type=${type}`),
  });

  const banToggle = useMutation({
    mutationFn: (u: AdminUser) =>
      apiSend("POST", `/admin/users/${u.id}/${u.isBanned ? "unban" : "ban"}`),
    onSuccess: (_res, u) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast(u.isBanned ? `${u.artistName} unbanned` : `${u.artistName} banned`);
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Action failed", "error"),
  });

  const users: AdminUser[] = data?.users ?? [];

  return (
    <div>
      <h1 className="text-[32px] font-bold gradient-text mb-6">User Management</h1>
      <div className="flex gap-3 flex-wrap mb-6">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt3" />
          <input
            className="input !h-11 !pl-10"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select !h-11 w-40" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="LISTENER">Listeners</option>
          <option value="ARTIST">Artists</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner center />
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-txt3 text-xs uppercase tracking-wider border-b border-line">
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Plan</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={u.profileImage}
                        name={u.artistName}
                        size={34}
                        accent={u.userType === "ARTIST" ? "purple" : "cyan"}
                      />
                      <div>
                        <p className="font-semibold">{u.artistName}</p>
                        <p className="text-txt3 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={u.isAdmin ? "ADMIN" : u.userType} />
                  </td>
                  <td className="px-5 py-3 text-txt2">{planLabel(u.subscriptionPlan)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      status={
                        u.isBanned
                          ? "BANNED"
                          : u.subscriptionStatus === "active"
                            ? "ACTIVE"
                            : (u.subscriptionStatus ?? "FREE").toUpperCase()
                      }
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!u.isAdmin && (
                      <button
                        className={u.isBanned ? "btn btn-secondary btn-sm" : "btn btn-danger btn-sm"}
                        onClick={() => banToggle.mutate(u)}
                        disabled={banToggle.isPending}
                      >
                        {u.isBanned ? "Unban" : "Ban"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-txt3">
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
