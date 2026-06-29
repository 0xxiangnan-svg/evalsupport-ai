import { TicketStatusSelect } from "@/components/admin/ticket-status-select";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listTickets } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

type TicketRecord = {
  id: string;
  question: string;
  trigger_reason: string;
  status: string;
  ai_assessment: string | null;
  session_label?: string | null;
  created_at: string;
};

export default async function TicketsPage() {
  const tickets = (await listTickets()) as TicketRecord[];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">Admin console</p>
        <h1 className="mt-2 text-2xl font-semibold">工单后台</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">未解决问题</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>问题</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>触发原因</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>AI 初判</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">更新</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="max-w-[260px]">
                    <div className="line-clamp-3 font-medium">{ticket.question}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {ticket.session_label ?? "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {ticket.trigger_reason}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <div className="line-clamp-3 text-sm text-muted-foreground">
                      {ticket.ai_assessment ?? "-"}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
                  </TableCell>
                </TableRow>
              ))}
              {!tickets.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    暂无工单
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
