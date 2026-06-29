import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "failed" ||
    status === "ticket_created" ||
    status === "answer_anomaly" ||
    status === "open"
      ? "destructive"
      : status === "indexed" || status === "answered" || status === "resolved"
        ? "secondary"
        : "outline";

  return <Badge variant={variant}>{status}</Badge>;
}
