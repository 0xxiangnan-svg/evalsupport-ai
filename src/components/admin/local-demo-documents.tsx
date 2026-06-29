"use client";

import { useSyncExternalStore } from "react";
import { Play, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  clearDemoSession,
  loadDemoSession,
  markDemoDocumentIndexed,
  subscribeDemoSession,
} from "@/lib/local-demo/session";
import type { DemoSession } from "@/lib/local-demo/types";

const emptySession: DemoSession = {
  documents: [],
  chunks: [],
};

export function LocalDemoDocuments() {
  const session = useSyncExternalStore(
    subscribeDemoSession,
    loadDemoSession,
    () => emptySession,
  );

  function indexDocument(documentId: string) {
    markDemoDocumentIndexed(documentId);
  }

  function clearDocuments() {
    clearDemoSession();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={clearDocuments}
          disabled={!session.documents.length}
        >
          <Trash2 className="h-4 w-4" />
          清空
        </Button>
      </div>
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
          {session.documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell className="font-medium">{document.filename}</TableCell>
              <TableCell>{document.fileType}</TableCell>
              <TableCell>
                <StatusBadge status={document.status} />
              </TableCell>
              <TableCell className="font-mono">{document.chunkCount}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {new Date(document.createdAt).toLocaleString("zh-CN")}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => indexDocument(document.id)}
                  disabled={document.status === "indexed"}
                >
                  <Play className="h-4 w-4" />
                  Index
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!session.documents.length ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                暂无文档
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
