"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
function ProfileSection() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    setUploadError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setUploadError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    await updateProfile.mutateAsync({ avatarUrl: `${publicUrl}?t=${Date.now()}` });
    setAvatarImgError(false);
    setUploading(false);
  }

  if (isLoading) return <div className="h-20 bg-border/40 animate-pulse" />;

  const initials = profile?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <div>
      <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
        Profile
      </h2>
      <div className="border border-border p-4 space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative w-14 h-14 flex-shrink-0 bg-border flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity disabled:opacity-40 group"
            title="Change profile picture"
          >
            {profile?.avatar_url && !avatarImgError ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? ""}
                className="w-full h-full object-cover"
                onError={() => setAvatarImgError(true)}
              />
            ) : (
              <span className="font-mono text-sm font-semibold text-muted">
                {initials}
              </span>
            )}
            <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                {uploading ? "..." : "Edit"}
              </span>
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{profile?.display_name}</p>
            <p className="text-xs text-muted">{profile?.email}</p>
            {uploadError && (
              <p className="text-xs text-red-600 mt-0.5">{uploadError}</p>
            )}
          </div>
        </div>

        {/* Display name */}
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate({ displayName: displayName.trim() });
              setEditingName(false);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className="flex-1 border border-border bg-surface-2 px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink"
              autoFocus
            />
            <button
              type="submit"
              disabled={!displayName.trim() || updateProfile.isPending}
              className="bg-ink text-surface font-mono text-xs px-4 py-2 disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="font-mono text-xs text-muted hover:text-ink px-3 py-2"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              setDisplayName(profile?.display_name ?? "");
              setEditingName(true);
            }}
            className="font-mono text-xs text-muted hover:text-ink transition-colors"
          >
            Change display name
          </button>
        )}
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const { data: profile } = trpc.profile.get.useQuery();
  const sendNotification = trpc.profile.sendPasswordChangedEmail.useMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!profile?.email) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInError) {
      setError("Incorrect current password");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await sendNotification.mutateAsync();

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
    setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div>
      <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
        Change password
      </h2>
      <form onSubmit={handleSubmit} className="border border-border p-4 space-y-4">
        <div>
          <label className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
            Current password
          </label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
            New password
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
            Confirm new password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && (
          <p className="text-xs text-green-700">
            Password changed. A confirmation email has been sent.
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          className="bg-ink text-surface font-mono text-sm px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {loading ? "Updating..." : "Change password"}
        </button>
      </form>
    </div>
  );
}

function MyGroupsSection() {
  const utils = trpc.useUtils();
  const { data: groups, isLoading } = trpc.groups.list.useQuery();
  const leaveGroup = trpc.groups.leave.useMutation({
    onSuccess: () => utils.groups.list.invalidate(),
  });

  return (
    <div>
      <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
        My groups
      </h2>
      {isLoading ? (
        <div className="h-10 bg-border/40 animate-pulse" />
      ) : (groups ?? []).length === 0 ? (
        <p className="text-xs text-muted border border-border px-4 py-3">
          You&apos;re not in any groups yet.
        </p>
      ) : (
        <div className="border border-border divide-y divide-border">
          {(groups ?? []).map((group) => (
            <div key={group.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <span className="font-mono text-sm text-ink">. {group.name}</span>
              <button
                onClick={() => leaveGroup.mutate({ groupId: group.id })}
                disabled={leaveGroup.isPending}
                className="font-mono text-xs text-muted hover:text-red-600 transition-colors"
              >
                Leave
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceSection() {
  const { data: workspace, isLoading } = trpc.workspace.get.useQuery();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const updateWorkspace = trpc.workspace.update.useMutation({
    onSuccess: () => {
      utils.workspace.get.invalidate();
      setEditing(false);
    },
  });

  if (isLoading) return <div className="h-16 bg-border/40 animate-pulse" />;

  return (
    <div>
      <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
        Workspace
      </h2>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateWorkspace.mutate({ name });
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border border-border bg-surface-2 px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink"
            autoFocus
          />
          <button
            type="submit"
            disabled={!name.trim() || updateWorkspace.isPending}
            className="bg-ink text-surface font-mono text-xs px-4 py-2 disabled:opacity-40"
          >
            {updateWorkspace.isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="font-mono text-xs text-muted hover:text-ink px-3 py-2"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between border border-border px-4 py-3">
          <span className="font-mono text-sm font-semibold text-ink">
            {workspace?.name}
          </span>
          <button
            onClick={() => {
              setName(workspace?.name ?? "");
              setEditing(true);
            }}
            className="font-mono text-xs text-muted hover:text-ink transition-colors"
          >
            Rename
          </button>
        </div>
      )}
    </div>
  );
}

function MembersSection() {
  const { data: members, isLoading } = trpc.members.list.useQuery();

  if (isLoading)
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-border/40 animate-pulse" />
        ))}
      </div>
    );

  return (
    <div>
      <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
        Members ({members?.length ?? 0})
      </h2>
      <div className="border border-border divide-y divide-border">
        {(members ?? []).map((member) => (
          <div key={member.id} className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">
                  {member.display_name}
                </span>
                {member.role === "ADMIN" && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted border border-border px-1.5 py-0.5">
                    admin
                  </span>
                )}
              </div>
              <span className="text-xs text-muted">{member.email}</span>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              {member.groups.map((g: { group_id: string; group_name: string }) => (
                <span
                  key={g.group_id}
                  className="font-mono text-[10px] text-muted border border-border px-1.5 py-0.5"
                >
                  .{g.group_name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvitesSection() {
  const utils = trpc.useUtils();
  const { data: pendingInvites, isLoading } = trpc.invites.list.useQuery();
  const { data: groups } = trpc.groups.list.useQuery();

  const [email, setEmail] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const sendInvite = trpc.invites.send.useMutation({
    onSuccess: () => {
      utils.invites.list.invalidate();
      setEmail("");
      setSelectedGroups([]);
      setSendSuccess(true);
      setSending(false);
      setTimeout(() => setSendSuccess(false), 3000);
    },
    onError: (err) => {
      setSendError(err.message);
      setSending(false);
    },
  });

  const revokeInvite = trpc.invites.revoke.useMutation({
    onSuccess: () => {
      utils.invites.list.invalidate();
    },
  });

  function toggleGroup(groupId: string) {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }

  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSendError(null);
    setSending(true);
    sendInvite.mutate({ email, groupIds: selectedGroups });
  }

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div>
        <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
          Invite someone
        </h2>
        <form onSubmit={handleSendInvite} className="border border-border p-4 space-y-4">
          <div>
            <label className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
              Add to groups
            </label>
            {(groups ?? []).length === 0 ? (
              <p className="text-xs text-muted">No groups available</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(groups ?? []).map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`font-mono text-xs px-3 py-1.5 border transition-colors ${
                      selectedGroups.includes(group.id)
                        ? "bg-ink text-surface border-ink"
                        : "border-border text-muted hover:text-ink hover:border-ink"
                    }`}
                  >
                    .{group.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {sendError && (
            <p className="text-xs text-red-600">{sendError}</p>
          )}
          {sendSuccess && (
            <p className="text-xs text-green-700">Invite sent!</p>
          )}

          <button
            type="submit"
            disabled={sending || !email || selectedGroups.length === 0}
            className="bg-ink text-surface font-mono text-sm px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {sending ? "Sending..." : "Send invite"}
          </button>
        </form>
      </div>

      {/* Pending invites */}
      <div>
        <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
          Pending invites ({pendingInvites?.length ?? 0})
        </h2>
        {isLoading ? (
          <div className="h-10 bg-border/40 animate-pulse" />
        ) : (pendingInvites ?? []).length === 0 ? (
          <p className="text-xs text-muted border border-border px-4 py-3">
            No pending invites
          </p>
        ) : (
          <div className="border border-border divide-y divide-border">
            {(pendingInvites ?? []).map((invite) => (
              <div
                key={invite.id}
                className="px-4 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm text-ink">{invite.email}</p>
                  <p className="text-xs text-muted font-mono">
                    Invited by{" "}
                    {(invite.profiles as { display_name: string } | null)
                      ?.display_name ?? "someone"}{" "}
                    · {new Date(invite.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeInvite.mutate({ inviteId: invite.id })}
                  disabled={revokeInvite.isPending}
                  className="font-mono text-xs text-muted hover:text-red-600 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupsSection() {
  const utils = trpc.useUtils();
  const { data: groups, isLoading } = trpc.groups.list.useQuery();
  const [name, setName] = useState("");

  const createGroup = trpc.groups.create.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      setName("");
    },
  });

  return (
    <div>
      <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
        Groups
      </h2>

      {/* Existing groups */}
      {isLoading ? (
        <div className="h-10 bg-border/40 animate-pulse mb-3" />
      ) : (groups ?? []).length === 0 ? (
        <p className="text-xs text-muted mb-3">No groups yet.</p>
      ) : (
        <div className="border border-border divide-y divide-border mb-4">
          {(groups ?? []).map((group) => (
            <div key={group.id} className="px-4 py-2.5 font-mono text-sm text-ink">
              . {group.name}
            </div>
          ))}
        </div>
      )}

      {/* Create group form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createGroup.mutate({ name: name.trim() });
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          maxLength={80}
          className="flex-1 border border-border bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={!name.trim() || createGroup.isPending}
          className="bg-ink text-surface font-mono text-xs px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {createGroup.isPending ? "Creating..." : "Create"}
        </button>
      </form>
      {createGroup.error && (
        <p className="text-xs text-red-600 mt-2">{createGroup.error.message}</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { data: profile } = trpc.profile.get.useQuery();
  const isAdmin = profile?.role === "ADMIN";

  return (
    <div className="flex h-screen bg-surface">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="mb-8 flex items-center gap-4">
            <Link
              href="/"
              className="font-mono text-xs text-muted hover:text-ink transition-colors"
            >
              ← Back
            </Link>
            <h1 className="font-mono text-lg font-semibold text-ink">
              Settings
            </h1>
          </div>

          <div className="space-y-10">
            <ProfileSection />
            <ChangePasswordSection />
            {!isAdmin && <MyGroupsSection />}
            {isAdmin && <WorkspaceSection />}
            {isAdmin && <GroupsSection />}
            {isAdmin && <MembersSection />}
            {isAdmin && <InvitesSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
