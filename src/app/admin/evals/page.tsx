import { EvalRunButton } from "@/components/admin/eval-run-button";
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
import { listEvalRuns } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

type EvalRunRecord = {
  id: string;
  status: string;
  total_cases: number;
  citation_accuracy: number | null;
  refusal_accuracy: number | null;
  answer_usability: number | null;
  created_at: string;
};

export default async function EvalsPage() {
  const runs = (await listEvalRuns()) as EvalRunRecord[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">Admin console</p>
          <h1 className="mt-2 text-2xl font-semibold">Eval 面板</h1>
        </div>
        <EvalRunButton />
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">引用正确率</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMetric(runs[0]?.citation_accuracy)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">拒答正确率</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMetric(runs[0]?.refusal_accuracy)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">回答可用率</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMetric(runs[0]?.answer_usability)}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">运行记录</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>状态</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead>引用</TableHead>
                <TableHead>拒答</TableHead>
                <TableHead>可用</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="font-mono">{run.total_cases}</TableCell>
                  <TableCell className="font-mono">
                    {formatMetric(run.citation_accuracy)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetric(run.refusal_accuracy)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatMetric(run.answer_usability)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(run.created_at).toLocaleString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))}
              {!runs.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    暂无 Eval 运行
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

function formatMetric(value: unknown) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "-";
}
