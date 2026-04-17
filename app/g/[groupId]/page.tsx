import { ThreadList } from "@/components/thread-list";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  return (
    <>
      <ThreadList groupId={groupId} />
      {/* Empty state for thread detail panel */}
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-sm text-muted">
          Select a thread to read it
        </p>
      </div>
    </>
  );
}
