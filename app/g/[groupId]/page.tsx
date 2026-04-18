import { createClient } from "@/lib/supabase/server";
import { ThreadList } from "@/components/thread-list";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  return (
    <>
      <ThreadList groupId={groupId} groupName={group?.name ?? groupId} />
      {/* Empty state for thread detail panel */}
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-sm text-muted">
          Select a thread to read it
        </p>
      </div>
    </>
  );
}
