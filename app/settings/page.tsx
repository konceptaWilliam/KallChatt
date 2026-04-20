"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

const CROP_DISPLAY = 280;
const MAX_ZOOM = 4;

function CropModal({
  src,
  onSave,
  onCancel,
}: {
  src: string;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  // zoom=1 means cover-fit (minimum zoom); zoom=MAX_ZOOM means 4× that
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef({ zoom: 1, offset: { x: 0, y: 0 }, cover: null as { w: number; h: number } | null });

  // Cover-fit dimensions: whichever dimension is shortest is set to CROP_DISPLAY
  const cover = useMemo(() => {
    if (!imgSize) return null;
    const ratio = imgSize.w / imgSize.h;
    return ratio > 1
      ? { w: CROP_DISPLAY * ratio, h: CROP_DISPLAY }
      : { w: CROP_DISPLAY, h: CROP_DISPLAY / ratio };
  }, [imgSize]);

  // Keep liveRef in sync so wheel handler always has current values
  useEffect(() => {
    liveRef.current = { zoom, offset, cover };
  });

  function clampOffset(ox: number, oy: number, z: number, cv: { w: number; h: number }) {
    const mx = (cv.w * z - CROP_DISPLAY) / 2;
    const my = (cv.h * z - CROP_DISPLAY) / 2;
    return {
      x: Math.min(mx, Math.max(-mx, ox)),
      y: Math.min(my, Math.max(-my, oy)),
    };
  }

  // Non-passive wheel zoom
  useEffect(() => {
    const el = cropAreaRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, offset, cover } = liveRef.current;
      if (!cover) return;
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      const nz = Math.min(MAX_ZOOM, Math.max(1, zoom * factor));
      setZoom(nz);
      setOffset(clampOffset(offset.x, offset.y, nz, cover));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  function startDrag(cx: number, cy: number) {
    dragRef.current = { sx: cx, sy: cy, ox: offset.x, oy: offset.y };
    setIsDragging(true);
  }

  function moveDrag(cx: number, cy: number) {
    if (!dragRef.current || !cover) return;
    setOffset(clampOffset(
      dragRef.current.ox + cx - dragRef.current.sx,
      dragRef.current.oy + cy - dragRef.current.sy,
      zoom,
      cover,
    ));
  }

  function endDrag() {
    setIsDragging(false);
    dragRef.current = null;
  }

  async function handleSave() {
    if (!cover || !imgSize) return;
    const rw = cover.w * zoom;
    const rh = cover.h * zoom;
    const imgLeft = CROP_DISPLAY / 2 + offset.x - rw / 2;
    const imgTop = CROP_DISPLAY / 2 + offset.y - rh / 2;
    const srcX = ((0 - imgLeft) / rw) * imgSize.w;
    const srcY = ((0 - imgTop) / rh) * imgSize.h;
    const srcW = (CROP_DISPLAY / rw) * imgSize.w;
    const srcH = (CROP_DISPLAY / rh) * imgSize.h;

    const img = new Image();
    img.src = src;
    if (!img.complete) await new Promise<void>((r) => { img.onload = () => r(); });

    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    canvas.getContext("2d")!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 400, 400);
    canvas.toBlob((blob) => { if (blob) onSave(blob); }, "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border w-full max-w-sm">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="font-mono text-xs text-muted uppercase tracking-wider">
            Crop photo
          </span>
          <button
            onClick={onCancel}
            className="font-mono text-xl leading-none text-muted hover:text-ink transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {/* Crop area */}
          <div
            ref={cropAreaRef}
            className="relative mx-auto overflow-hidden select-none"
            style={{
              width: CROP_DISPLAY,
              height: CROP_DISPLAY,
              background: "#000",
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
            onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                startDrag(e.touches[0].clientX, e.touches[0].clientY);
              } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastPinchDist.current = Math.hypot(dx, dy);
                endDrag();
              }
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              if (e.touches.length === 1 && dragRef.current) {
                moveDrag(e.touches[0].clientX, e.touches[0].clientY);
              } else if (e.touches.length === 2 && lastPinchDist.current && cover) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const nz = Math.min(MAX_ZOOM, Math.max(1, zoom * (dist / lastPinchDist.current)));
                setOffset((prev) => clampOffset(prev.x, prev.y, nz, cover));
                setZoom(nz);
                lastPinchDist.current = dist;
              }
            }}
            onTouchEnd={() => { endDrag(); lastPinchDist.current = null; }}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              style={{
                position: "absolute",
                width: cover?.w ?? 0,
                height: cover?.h ?? 0,
                left: cover ? (CROP_DISPLAY - cover.w) / 2 : 0,
                top: cover ? (CROP_DISPLAY - cover.h) / 2 : 0,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                pointerEvents: "none",
              }}
            />
            {/* Square border */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.55)" }}
            />
            {/* Corner handles */}
            {[
              { top: 0, left: 0 },
              { top: 0, right: 0 },
              { bottom: 0, left: 0 },
              { bottom: 0, right: 0 },
            ].map((pos, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 pointer-events-none"
                style={{
                  ...pos,
                  borderTop: pos.top === 0 ? "2px solid white" : undefined,
                  borderBottom: pos.bottom === 0 ? "2px solid white" : undefined,
                  borderLeft: pos.left === 0 ? "2px solid white" : undefined,
                  borderRight: pos.right === 0 ? "2px solid white" : undefined,
                }}
              />
            ))}
          </div>

          {/* Zoom slider */}
          <div className="mt-4 flex items-center gap-3">
            <span className="font-mono text-sm text-muted leading-none">−</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                const nz = parseFloat(e.target.value);
                if (cover) setOffset((prev) => clampOffset(prev.x, prev.y, nz, cover));
                setZoom(nz);
              }}
              className="flex-1 accent-ink h-1"
            />
            <span className="font-mono text-sm text-muted leading-none">+</span>
          </div>
        </div>

        <div className="px-4 pb-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="font-mono text-xs text-muted hover:text-ink transition-colors px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="font-mono text-xs bg-ink text-surface px-4 py-2 hover:bg-ink/90 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
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
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be picked again
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setCropSrc(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleCropSave(blob: Blob) {
    if (!profile) return;
    setCropSrc(null);
    setUploading(true);
    setUploadError(null);

    const supabase = createClient();
    const path = `${profile.id}/avatar.jpg`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

    if (upErr) {
      setUploadError(upErr.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await updateProfile.mutateAsync({ avatarUrl: `${publicUrl}?t=${Date.now()}` });
    setAvatarImgError(false);
    setUploading(false);
  }

  if (isLoading) return <div className="h-20 bg-border/40 animate-pulse" />;

  const initials = profile?.display_name
    ?.split(" ")
    .map((n: string) => n[0])
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
          {cropSrc && (
            <CropModal
              src={cropSrc}
              onSave={handleCropSave}
              onCancel={() => setCropSrc(null)}
            />
          )}
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

function LogOutSection() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <div>
      <h2 className="font-mono text-xs text-muted uppercase tracking-wider mb-3">Account</h2>
      <div className="border border-border px-4 py-3">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="font-mono text-sm text-red-600 hover:text-red-700 transition-colors disabled:opacity-40"
        >
          {signingOut ? "Signing out…" : "Log out"}
        </button>
      </div>
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
            <LogOutSection />
          </div>
        </div>
      </div>
    </div>
  );
}
