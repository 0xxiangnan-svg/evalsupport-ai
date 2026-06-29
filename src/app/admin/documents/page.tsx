import { AlertCircle } from "lucide-react";

import { DocumentIndexButton } from "@/components/admin/document-actions";
import { DocumentUploader } from "@/components/admin/document-uploader";
import { LocalDemoDocuments } from "@/components/admin/local-demo-documents";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasSupabaseConfig, isProductionDeployment } from "@/lib/config";
import { listDocuments } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const configured = hasSupabaseConfig();
  const productionMissingDatabase = isProductionDeployment() && !configured;
  const documents = await listDocuments();

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">Admin console</p>
        <h1 className="mt-2 text-2xl font-semibold">知识库文档</h1>
      </div>

      {productionMissingDatabase ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>线上数据库未配置</AlertTitle>
          <AlertDescription>
            生产环境已禁用本地 Demo。请配置 Supabase 环境变量并重新部署。
          </AlertDescription>
        </Alert>
      ) : !configured ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>本地 Demo 模式</AlertTitle>
          <AlertDescription>
            当前使用浏览器本地 Demo 会话；配置 Supabase 后切换为持久化知识库。
          </AlertDescription>
        </Alert>
      ) : null}

      {!productionMissingDatabase ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">上传文档</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploader />
          </CardContent>
        </Card>
      ) : null}

      {!productionMissingDatabase ? <Card>
        <CardHeader>
          <CardTitle className="text-base">文档列表</CardTitle>
        </CardHeader>
        <CardContent>
          {configured ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文件</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>上传时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="font-medium">{document.filename}</TableCell>
                    <TableCell>{document.file_type}</TableCell>
                    <TableCell>
                      <StatusBadge status={document.status} />
                    </TableCell>
                    <TableCell className="font-mono">
                      {document.chunk_count ?? 0}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(document.created_at).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DocumentIndexButton
                        documentId={document.id}
                        disabled={document.status === "indexing"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!documents.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      暂无文档
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          ) : (
            <LocalDemoDocuments />
          )}
        </CardContent>
      </Card> : null}
    </div>
  );
}
