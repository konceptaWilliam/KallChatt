import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThreadList } from "@/components/thread-list";
import { ThreadDetail } from "@/components/thread-detail";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ groupId: string; threadId: string }>;
}) {
  const { groupId, threadId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch thread
  const { data: thread } = await supabase
    .from("threads")
    .select("id, title, status, group_id")
    .eq("id", threadId)
    .eq("group_id", groupId)
    .single();

  if (!thread) notFound();

  return (
    <>
      <ThreadList groupId={groupId} />
      <ThreadDetail
        threadId={threadId}
        groupId={groupId}
        initialTitle={thread.title}
        initialStatus={thread.status as "OPEN" | "URGENT" | "DONE"}
      />
    </>
  );
}
