"use client";

import { useState } from "react";
import {
  BookOpenCheck,
  Clock3,
  Loader2,
  Send,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getIndexedDemoChunks } from "@/lib/local-demo/session";

type Citation = {
  label: string;
  documentName: string;
  content: string;
  similarity: number;
};

type ChatResult = {
  status: "answered" | "ticket_created";
  answer: string;
  citations: Citation[];
  ticket: { id: string; triggerReason: string } | null;
  conversationId: string;
  metrics: {
    latencyMs: number;
    topSimilarity: number | null;
    totalTokens: number | null;
    model: string | null;
  };
};

type Message = {
  role: "user" | "assistant";
  content: string;
  result?: ChatResult;
};

const suggestedQuestions = [
  "年付订单什么时候开发票？",
  "标准版试用期多久？",
  "今天北京天气怎么样？",
];

export function ChatConsole() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitQuestion() {
    const trimmed = question.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setQuestion("");
    setIsLoading(true);
    setError(null);

    try {
      const demoChunks = getIndexedDemoChunks();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          demoChunks: demoChunks.length ? demoChunks : undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "请求失败");
      }

      const result = payload as ChatResult;
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer, result },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "请求失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid min-h-[640px] flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-[0_24px_100px_rgba(0,0,0,0.22)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">客服问答</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              回答必须命中知识库来源，否则自动转工单
            </p>
          </div>
          <Badge variant="outline" className="h-7 border-primary/30 text-primary">
            RAG
          </Badge>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <ScrollArea className="min-h-0 flex-1 pr-3">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex min-h-[360px] flex-col justify-center rounded-2xl border border-dashed border-border/80 bg-background/30 p-6">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <BookOpenCheck className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 max-w-[16ch] text-2xl font-semibold tracking-tight">
                    从知识库开始一次可追踪回答
                  </h3>
                  <p className="mt-3 max-w-[46ch] text-sm leading-6 text-muted-foreground">
                    先在后台上传并 Index 文档，再提问。无关问题会触发工单兜底。
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {suggestedQuestions.map((item) => (
                      <Button
                        key={item}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setQuestion(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[82%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground shadow-[0_12px_36px_rgba(45,212,191,0.16)]"
                        : "max-w-[88%] rounded-2xl border border-border/80 bg-background/45 px-4 py-3 text-sm"
                    }
                  >
                    <div className="whitespace-pre-wrap leading-6">{message.content}</div>
                    {message.result ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge
                          variant={
                            message.result.status === "answered"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {message.result.status === "answered" ? "已回答" : "已建工单"}
                        </Badge>
                        <Badge variant="outline">
                          <Clock3 className="h-3 w-3" />
                          {message.result.metrics.latencyMs} ms
                        </Badge>
                        {message.result.metrics.model ? (
                          <Badge variant="outline">{message.result.metrics.model}</Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              {isLoading ? (
                <div className="max-w-[88%] rounded-2xl border border-border/80 bg-background/45 px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    正在检索知识库并校验引用
                  </div>
                </div>
              ) : null}
            </div>
          </ScrollArea>

          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="support-question">
              问题输入
            </label>
            <div className="flex gap-2">
              <Textarea
                id="support-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void submitQuestion();
                  }
                }}
                placeholder="例如：企业版发票什么时候开具？"
                className="min-h-20 resize-none"
              />
              <Button
                className="h-20 w-20 shrink-0"
                onClick={() => void submitQuestion()}
                disabled={isLoading || !question.trim()}
                aria-label="发送问题"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[640px] overflow-hidden rounded-2xl border border-border/80 bg-card/65 backdrop-blur">
        <div className="border-b border-border/70 px-5 py-4">
          <h2 className="text-base font-semibold">证据流</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            展示最近一次回答的来源或兜底原因
          </p>
        </div>
        <div className="p-4">
          <ScrollArea className="h-[548px] pr-3">
            <div className="space-y-3">
              {messages.filter((message) => message.result).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-background/25 p-4 text-sm text-muted-foreground">
                  这里会显示引用 chunk、相似度分数、工单 ID 和触发原因。
                </div>
              ) : null}
              {messages
                .filter((message) => message.result)
                .slice(-1)
                .map((message) => {
                  const result = message.result!;
                  if (result.ticket) {
                    return (
                      <div
                        key={result.conversationId}
                        className="rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-sm"
                      >
                        <div className="mb-2 flex items-center gap-2 font-medium">
                          <TicketCheck className="h-4 w-4 text-destructive" />
                          工单已创建
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {result.ticket.id}
                        </p>
                        <p className="mt-2 text-muted-foreground">
                          {result.ticket.triggerReason}
                        </p>
                      </div>
                    );
                  }

                  return result.citations.map((citation) => (
                    <div
                      key={`${result.conversationId}-${citation.label}`}
                      className="rounded-2xl border border-border/80 bg-background/35 p-3 text-sm"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge>
                          <ShieldCheck className="h-3 w-3" />
                          {citation.label}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {citation.similarity.toFixed(3)}
                        </span>
                      </div>
                      <p className="font-medium">{citation.documentName}</p>
                      <p className="mt-2 line-clamp-5 text-muted-foreground">
                        {citation.content}
                      </p>
                    </div>
                  ));
                })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </section>
  );
}
