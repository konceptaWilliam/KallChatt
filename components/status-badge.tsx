type Status = "OPEN" | "URGENT" | "DONE";

const styles: Record<Status, string> = {
  OPEN: "bg-[#E8E7E2] text-[#5A5954] text-xs px-2 py-0.5 font-mono",
  URGENT:
    "bg-accent-light text-accent text-xs px-2 py-0.5 font-mono font-semibold border border-accent/30",
  DONE: "bg-[#D1FAE5] text-[#065F46] text-xs px-2 py-0.5 font-mono",
};

const labels: Record<Status, string> = {
  OPEN: "open",
  URGENT: "urgent",
  DONE: "done",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block uppercase tracking-wide ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
