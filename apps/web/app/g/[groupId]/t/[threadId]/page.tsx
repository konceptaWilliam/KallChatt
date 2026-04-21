import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThreadList } from "@/components/thread-list";
import { ThreadDetail } from "@/components/thread-detail";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; threadId: string }>;
  searchParams: Promise<{ highlight?: string }>;
}) {
  const { groupId, threadId } = await params;
  const { highlight } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch thread + group name in parallel
  const [{ data: thread }, { data: group }] = await Promise.all([
    supabase
      .from("threads")
      .select("id, title, status, group_id")
      .eq("id", threadId)
      .eq("group_id", groupId)
      .single(),
    supabase.from("groups").select("name").eq("id", groupId).single(),
  ]);

  if (!thread) notFound();

  return (
    <>
      <ThreadList groupId={groupId} groupName={group?.name ?? groupId} />
      <ThreadDetail
        threadId={threadId}
        groupId={groupId}
        initialTitle={thread.title}
        initialStatus={thread.status as "OPEN" | "URGENT" | "DONE"}
        highlightMessageId={highlight}
      />
    </>
  );
}
