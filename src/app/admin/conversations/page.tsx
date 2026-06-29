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
import { listConversations } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

type ConversationRecord = {
  id: string;
  question: string;
  answer: string;
  status: string;
  top_similarity: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  citations?: unknown[];
  session_label?: string | null;
  created_at: string;
};

export default async function ConversationsPage() {
  const conversations = (await listConversations()) as ConversationRecord[];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">Admin console</p>
        <h1 className="mt-2 text-2xl font-semibold">会话追踪</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近会话</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>问题</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>Top Score</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead>引用</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((conversation) => (
                <TableRow key={conversation.id}>
                  <TableCell className="max-w-[280px]">
                    <div className="line-clamp-2 font-medium">
                      {conversation.question}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {conversation.answer}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {conversation.session_label ?? "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={conversation.status} />
                  </TableCell>
                  <TableCell className="font-mono">
                    {typeof conversation.top_similarity === "number"
                      ? conversation.top_similarity.toFixed(3)
                      : "-"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {conversation.total_tokens ?? "-"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {conversation.latency_ms ?? "-"} ms
                  </TableCell>
                  <TableCell className="font-mono">
                    {conversation.citations?.length ?? 0}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(conversation.created_at).toLocaleString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))}
              {!conversations.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    暂无会话
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
