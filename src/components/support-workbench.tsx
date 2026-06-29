"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  LockKeyhole,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  clearProviderSettings,
  DEFAULT_PROVIDER_SETTINGS,
  hasCompleteProviderSettings,
  loadProviderSettings,
  saveProviderSettings,
  toProviderConfig,
  type BrowserProviderSettings,
} from "@/lib/provider-settings";
import {
  getIndexedDemoChunks,
  seedSampleDemoSession,
  subscribeDemoSession,
} from "@/lib/local-demo/session";

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

type RuntimeStatus = {
  production: boolean;
  supabaseConfigured: boolean;
  persistent: boolean;
  localDemoEnabled: boolean;
  browserDemoAvailable: boolean;
  serverAiConfigured: boolean;
  indexedDocumentCount: number | null;
  missingProductionEnv: string[];
  defaultProvider: {
    baseUrl: string;
    chatModel: string;
    embeddingProvider: string;
  };
};

type ProviderTestState =
  | { status: "idle"; message: string | null }
  | { status: "loading"; message: string | null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const suggestedQuestions = [
  "年付订单什么时候开发票？",
  "标准版试用期多久？",
  "什么情况下会自动创建工单？",
  "今天北京天气怎么样？",
];

export function SupportWorkbench() {
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [providerSettings, setProviderSettings] =
    useState<BrowserProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  const [showApiKey, setShowApiKey] = useState(false);
  const [providerTest, setProviderTest] = useState<ProviderTestState>({
    status: "idle",
    message: null,
  });
  const [demoChunkCount, setDemoChunkCount] = useState(0);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    const syncBrowserState = window.setTimeout(() => {
      setProviderSettings(loadProviderSettings());
      setDemoChunkCount(getIndexedDemoChunks().length);
    }, 0);

    const unsubscribe = subscribeDemoSession(() => {
      setDemoChunkCount(getIndexedDemoChunks().length);
    });

    return () => {
      window.clearTimeout(syncBrowserState);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRuntimeStatus() {
      try {
        const response = await fetch("/api/runtime/status", {
          cache: "no-store",
        });
        const payload = (await response.json()) as RuntimeStatus;
        if (!response.ok) {
          throw new Error("运行状态读取失败");
        }
        if (!cancelled) {
          setRuntimeStatus(payload);
          setRuntimeError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setRuntimeError(caught instanceof Error ? caught.message : "运行状态读取失败");
        }
      }
    }

    void loadRuntimeStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtimeStatus || runtimeStatus.supabaseConfigured || demoChunkCount > 0) {
      return;
    }

    const seedTimer = window.setTimeout(() => {
      const chunks = seedSampleDemoSession();
      setDemoChunkCount(chunks.length);
    }, 0);

    return () => {
      window.clearTimeout(seedTimer);
    };
  }, [demoChunkCount, runtimeStatus]);

  const providerConfigured = hasCompleteProviderSettings(providerSettings);
  const providerConfig = toProviderConfig(providerSettings);
  const persistentKnowledgeReady = Boolean(
    runtimeStatus?.supabaseConfigured &&
      (runtimeStatus.indexedDocumentCount ?? 0) > 0,
  );
  const browserDemoReady = Boolean(
    !runtimeStatus?.supabaseConfigured && demoChunkCount > 0,
  );
  const hasKnowledge = persistentKnowledgeReady || browserDemoReady;
  const canUseLocalRules = browserDemoReady;
  const hasModelPath = Boolean(
    providerConfigured || runtimeStatus?.serverAiConfigured || canUseLocalRules,
  );
  const canSend = hasKnowledge && hasModelPath;
  const lastResult = useMemo(
    () =>
      messages
        .filter((message) => message.result)
        .slice(-1)[0]?.result ?? null,
    [messages],
  );

  const modelSource = providerConfigured
    ? "用户 API"
    : runtimeStatus?.serverAiConfigured
      ? "服务器 API"
      : canUseLocalRules
        ? "本地规则"
        : "未配置";
  const knowledgeMode = runtimeStatus?.supabaseConfigured
    ? "Supabase RAG"
    : "浏览器样例库";

  function updateProviderSettings(next: BrowserProviderSettings) {
    setProviderSettings(next);
    saveProviderSettings(next);
    setProviderTest({ status: "idle", message: null });
  }

  function resetProviderSettings() {
    clearProviderSettings();
    setProviderSettings(DEFAULT_PROVIDER_SETTINGS);
    setProviderTest({ status: "idle", message: "已清空浏览器中的用户 API 配置" });
  }

  async function testProvider() {
    const config = toProviderConfig(providerSettings);
    if (!config) {
      setProviderTest({
        status: "error",
        message: "请填写 Base URL、API Key 和 Chat Model",
      });
      return;
    }

    setProviderTest({ status: "loading", message: "正在测试连接" });
    try {
      const response = await fetch("/api/provider/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerConfig: config }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        model?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "连接测试失败");
      }
      setProviderTest({
        status: "success",
        message: `连接成功，模型 ${payload.model ?? config.chatModel}`,
      });
    } catch (caught) {
      setProviderTest({
        status: "error",
        message: caught instanceof Error ? caught.message : "连接测试失败",
      });
    }
  }

  function loadSampleKnowledge() {
    const chunks = seedSampleDemoSession();
    setDemoChunkCount(chunks.length);
    setChatError(null);
  }

  async function submitQuestion() {
    const trimmed = question.trim();
    if (!trimmed || isLoading || !canSend) {
      return;
    }

    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setQuestion("");
    setIsLoading(true);
    setChatError(null);

    try {
      const demoChunks = getIndexedDemoChunks();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          providerConfig,
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
      setChatError(caught instanceof Error ? caught.message : "请求失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="workbench-background min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="workbench-shell mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <HeaderBar modelSource={modelSource} knowledgeMode={knowledgeMode} />

        <section className="grid flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_330px] 2xl:grid-cols-[320px_minmax(0,1fr)_370px]">
          <aside className="grid gap-3 xl:auto-rows-min">
            <SystemStatusPanel
              runtimeStatus={runtimeStatus}
              runtimeError={runtimeError}
              demoChunkCount={demoChunkCount}
              providerConfigured={providerConfigured}
              modelSource={modelSource}
            />
            <ModelSettingsPanel
              providerSettings={providerSettings}
              showApiKey={showApiKey}
              providerTest={providerTest}
              onChange={updateProviderSettings}
              onToggleApiKey={() => setShowApiKey((current) => !current)}
              onTest={() => void testProvider()}
              onClear={resetProviderSettings}
            />
            <KnowledgePanel
              runtimeStatus={runtimeStatus}
              demoChunkCount={demoChunkCount}
              onLoadSample={loadSampleKnowledge}
            />
          </aside>

          <ChatPanel
            question={question}
            messages={messages}
            isLoading={isLoading}
            chatError={chatError}
            canSend={canSend}
            hasKnowledge={hasKnowledge}
            hasModelPath={hasModelPath}
            runtimeStatus={runtimeStatus}
            onQuestionChange={setQuestion}
            onQuestionSelect={setQuestion}
            onLoadSample={loadSampleKnowledge}
            onSubmit={() => void submitQuestion()}
          />

          <EvidencePanel
            result={lastResult}
            modelSource={modelSource}
            className="hidden xl:block"
          />
        </section>

        <EvidencePanel
          result={lastResult}
          modelSource={modelSource}
          className="xl:hidden"
        />
      </div>
    </main>
  );
}

function HeaderBar({
  modelSource,
  knowledgeMode,
}: {
  modelSource: string;
  knowledgeMode: string;
}) {
  return (
    <header className="glass-panel glass-nav flex min-h-16 flex-col gap-3 px-3 py-3 md:flex-row md:items-center md:justify-between md:px-4">
      <Link href="/" className="group flex min-w-0 items-center gap-3">
        <span className="status-orbit flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_18px_36px_rgba(45,212,191,0.18)] transition-transform duration-300 group-hover:scale-[1.03]">
          ES
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-[0.01em] text-white">
            EvalSupport AI
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            可观测 RAG 客服工作台
          </span>
        </span>
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="h-7 border-primary/30 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <PlugZap className="h-3 w-3" />
          {modelSource}
        </Badge>
        <Badge variant="outline" className="h-7 border-white/15 bg-white/7 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <Database className="h-3 w-3" />
          {knowledgeMode}
        </Badge>
        <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-1 sm:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/conversations">会话</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/tickets">工单</Link>
          </Button>
        </div>
        <Button asChild className="shadow-[0_12px_34px_rgba(45,212,191,0.22)]">
          <Link href="/admin/documents">
            上传文档
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}

function SystemStatusPanel({
  runtimeStatus,
  runtimeError,
  demoChunkCount,
  providerConfigured,
  modelSource,
}: {
  runtimeStatus: RuntimeStatus | null;
  runtimeError: string | null;
  demoChunkCount: number;
  providerConfigured: boolean;
  modelSource: string;
}) {
  const indexedCount = runtimeStatus?.indexedDocumentCount ?? 0;
  const persistenceText = runtimeStatus?.supabaseConfigured
    ? "Supabase 持久化"
    : "浏览器 Demo";
  const knowledgeText = runtimeStatus?.supabaseConfigured
    ? `${indexedCount} 个已索引文档`
    : `${demoChunkCount} 个样例 chunk`;

  return (
    <section className="glass-panel panel-stack p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-primary">LIVE READINESS</p>
          <h2 className="mt-1 text-sm font-semibold">运行状态</h2>
          <p className="mt-1 text-xs text-muted-foreground">数据、知识库和模型链路</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <Sparkles className="h-4 w-4" />
        </span>
      </div>

      {runtimeError ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {runtimeError}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        <StatusRow icon={Database} label="数据模式" value={persistenceText} />
        <StatusRow icon={BookOpenCheck} label="知识库" value={knowledgeText} />
        <StatusRow icon={KeyRound} label="模型来源" value={modelSource} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="metric-glass p-3">
          <span className="block text-muted-foreground">用户 API</span>
          <span className="mt-1 flex items-center gap-1 font-medium">
            {providerConfigured ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            ) : (
              <CircleAlert className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {providerConfigured ? "已配置" : "未配置"}
          </span>
        </div>
        <div className="metric-glass p-3">
          <span className="block text-muted-foreground">服务器 API</span>
          <span className="mt-1 flex items-center gap-1 font-medium">
            {runtimeStatus?.serverAiConfigured ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            ) : (
              <CircleAlert className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {runtimeStatus?.serverAiConfigured ? "可用" : "未配置"}
          </span>
        </div>
      </div>
    </section>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="control-panel group flex items-center gap-3 px-3 py-2 transition-colors duration-200 hover:border-primary/20 hover:bg-primary/[0.06]">
      <Icon className="h-4 w-4 text-primary" />
      <span className="min-w-0 flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-xs font-medium">{value}</span>
    </div>
  );
}

function ModelSettingsPanel({
  providerSettings,
  showApiKey,
  providerTest,
  onChange,
  onToggleApiKey,
  onTest,
  onClear,
}: {
  providerSettings: BrowserProviderSettings;
  showApiKey: boolean;
  providerTest: ProviderTestState;
  onChange: (settings: BrowserProviderSettings) => void;
  onToggleApiKey: () => void;
  onTest: () => void;
  onClear: () => void;
}) {
  const testIsLoading = providerTest.status === "loading";

  return (
    <section className="glass-panel panel-stack p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-primary">BRING YOUR OWN KEY</p>
          <h2 className="mt-1 text-sm font-semibold">模型设置</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            API Key 只保存在当前浏览器
          </p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <LockKeyhole className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <LabeledInput
          label="Base URL"
          value={providerSettings.baseUrl}
          onChange={(value) =>
            onChange({ ...providerSettings, baseUrl: value })
          }
          placeholder="https://api.deepseek.com/v1"
        />
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="api-key">
            API Key
          </label>
          <div className="flex gap-2">
            <Input
              id="api-key"
              type={showApiKey ? "text" : "password"}
              value={providerSettings.apiKey}
              onChange={(event) =>
                onChange({ ...providerSettings, apiKey: event.target.value })
              }
              placeholder="仅保存在浏览器"
              autoComplete="off"
              className="glass-field"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={onToggleApiKey}
              aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <LabeledInput
          label="Chat Model"
          value={providerSettings.chatModel}
          onChange={(value) =>
            onChange({ ...providerSettings, chatModel: value })
          }
          placeholder="deepseek-chat"
        />
      </div>

      {providerTest.message ? (
        <div
          className={
            providerTest.status === "error"
              ? "mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
              : "mt-3 rounded-lg border border-primary/25 bg-primary/10 p-3 text-xs text-primary"
          }
        >
          {providerTest.message}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Button type="button" onClick={onTest} disabled={testIsLoading}>
          {testIsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlugZap className="h-4 w-4" />
          )}
          测试连接
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={onClear}
          aria-label="清空用户 API 设置"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="glass-field"
      />
    </div>
  );
}

function KnowledgePanel({
  runtimeStatus,
  demoChunkCount,
  onLoadSample,
}: {
  runtimeStatus: RuntimeStatus | null;
  demoChunkCount: number;
  onLoadSample: () => void;
}) {
  const hasSupabase = Boolean(runtimeStatus?.supabaseConfigured);
  const indexedCount = runtimeStatus?.indexedDocumentCount ?? 0;
  const canLoadSample = !runtimeStatus?.supabaseConfigured;

  return (
    <section className="glass-panel panel-stack p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-primary">SOURCE GROUNDING</p>
          <h2 className="mt-1 text-sm font-semibold">知识库</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            没有来源时不会强答
          </p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <FileText className="h-4 w-4" />
        </span>
      </div>

      <div className="source-meter mt-4 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {hasSupabase ? "持久化知识库" : "浏览器样例库"}
          </span>
          <Badge variant={hasSupabase || demoChunkCount > 0 ? "secondary" : "outline"}>
            {hasSupabase ? `${indexedCount} docs` : `${demoChunkCount} chunks`}
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {hasSupabase
            ? "线上持久化模式会从 Supabase pgvector 检索共享知识库。"
            : "无 Supabase 时可以加载样例知识库，刷新后仍保留在当前浏览器。"}
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {canLoadSample ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onLoadSample}
            onPointerDown={onLoadSample}
          >
            <RefreshCw className="h-4 w-4" />
            加载样例知识库
          </Button>
        ) : null}
        <Button asChild variant={canLoadSample ? "outline" : "default"}>
          <Link href="/admin/documents">
            去后台上传文档
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function ChatPanel({
  question,
  messages,
  isLoading,
  chatError,
  canSend,
  hasKnowledge,
  hasModelPath,
  runtimeStatus,
  onQuestionChange,
  onQuestionSelect,
  onLoadSample,
  onSubmit,
}: {
  question: string;
  messages: Message[];
  isLoading: boolean;
  chatError: string | null;
  canSend: boolean;
  hasKnowledge: boolean;
  hasModelPath: boolean;
  runtimeStatus: RuntimeStatus | null;
  onQuestionChange: (value: string) => void;
  onQuestionSelect: (value: string) => void;
  onLoadSample: () => void;
  onSubmit: () => void;
}) {
  const blockerText = !hasKnowledge
    ? "请先加载样例知识库或上传并索引文档"
    : !hasModelPath
      ? "请填写用户 API，或配置服务器 API"
      : null;
  const canLoadSample = !runtimeStatus?.supabaseConfigured;

  return (
    <section className="glass-panel command-stage flex min-h-[690px] flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-xs font-medium text-primary">ANSWER WORKFLOW</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-4xl">
            AI 客服主控台
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            先检索来源，再决定回答或创建工单
          </p>
        </div>
        <div className="hidden grid-cols-2 gap-2 text-right sm:grid">
          <Badge variant="outline" className="h-7 justify-center border-primary/30 bg-primary/10 text-primary">
            RAG
          </Badge>
          <Badge variant="outline" className="h-7 justify-center border-white/15 bg-white/7 text-muted-foreground">
            引用校验
          </Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <ScrollArea className="h-[500px] pr-3 lg:h-[calc(100dvh-300px)] lg:min-h-[430px]">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="hero-console grid min-h-[430px] gap-6 p-5 md:grid-cols-[minmax(0,1fr)_280px] md:p-6">
                <div className="flex flex-col justify-center">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                    <BookOpenCheck className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 max-w-[18ch] text-4xl font-semibold leading-[1.04] tracking-[-0.02em] text-white md:text-5xl">
                    从一条可验证回答开始
                  </h2>
                  <p className="mt-3 max-w-[48ch] text-sm leading-6 text-muted-foreground">
                    选择问题后，系统会检索知识库、绑定来源，并在低置信度时创建工单。
                  </p>
                  {blockerText ? (
                    <div className="mt-5 rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm text-primary">
                      {blockerText}
                    </div>
                  ) : null}
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {suggestedQuestions.map((item) => (
                      <Button
                        key={item}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="suggestion-chip h-auto min-h-9 justify-start whitespace-normal px-3 py-2 text-left leading-5"
                        onClick={() => onQuestionSelect(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                  {!hasKnowledge ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {canLoadSample ? (
                        <Button
                          type="button"
                          onClick={onLoadSample}
                          onPointerDown={onLoadSample}
                        >
                          <RefreshCw className="h-4 w-4" />
                          加载样例库
                        </Button>
                      ) : null}
                      <Button asChild variant="outline">
                        <Link href="/admin/documents">上传文档</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="hidden flex-col justify-center gap-3 md:flex">
                  <WorkflowTile
                    icon={Database}
                    title="检索"
                    description="Top K chunk"
                  />
                  <WorkflowTile
                    icon={ShieldCheck}
                    title="引用"
                    description="来源片段绑定"
                  />
                  <WorkflowTile
                    icon={TicketCheck}
                    title="兜底"
                    description="低置信度转工单"
                  />
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <MessageBubble
                  key={`${message.role}-${index}`}
                  message={message}
                />
              ))
            )}
            {isLoading ? (
              <div className="glass-inset max-w-[88%] px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  正在检索、生成并校验引用
                </div>
                <div className="mt-3 grid gap-2">
                  <span className="h-2 w-3/4 rounded-full bg-white/12" />
                  <span className="h-2 w-1/2 rounded-full bg-white/10" />
                  <span className="h-2 w-2/3 rounded-full bg-primary/20" />
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>

      <div className="composer-dock border-t border-white/10 p-4">
        {chatError ? (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {chatError}
          </div>
        ) : null}
        {blockerText ? (
          <div className="control-panel mb-3 px-3 py-2 text-xs text-muted-foreground">
            {blockerText}
          </div>
        ) : null}
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="support-question">
            问题输入
          </label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_84px]">
            <Textarea
              id="support-question"
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="例如：年付订单什么时候开发票？"
              className="glass-field min-h-20 resize-none text-base"
              disabled={isLoading}
            />
            <Button
              className="h-20 shrink-0 sm:w-[84px]"
              onClick={onSubmit}
              disabled={isLoading || !question.trim() || !canSend}
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
    </section>
  );
}

function WorkflowTile({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="workflow-tile p-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{description}</span>
        </span>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={
        isUser
          ? "ml-auto max-w-[82%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground shadow-[0_18px_40px_rgba(45,212,191,0.18)]"
          : "answer-bubble max-w-[88%] px-4 py-3 text-sm"
      }
    >
      <div className="whitespace-pre-wrap leading-6">{message.content}</div>
      {message.result ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge
            variant={
              message.result.status === "answered" ? "secondary" : "destructive"
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
  );
}

function EvidencePanel({
  result,
  modelSource,
  className,
}: {
  result: ChatResult | null;
  modelSource: string;
  className?: string;
}) {
  return (
    <aside className={`glass-panel evidence-rail min-h-[420px] overflow-hidden ${className ?? ""}`}>
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-primary">EVIDENCE RAIL</p>
            <h2 className="mt-1 text-sm font-semibold">证据与兜底</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              最近一次回答的来源和判断
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {modelSource}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <ScrollArea className="h-[520px] pr-3">
          <div className="space-y-3">
            {!result ? (
              <div className="hero-console p-4 text-sm text-muted-foreground">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="mt-4 font-medium text-foreground">等待一次问答</p>
                <p className="mt-2 leading-6">
                  回答完成后，这里会展示引用 chunk、相似度、工单 ID 和模型耗时。
                </p>
              </div>
            ) : null}

            {result ? (
              <div className="hero-console p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">本次判断</span>
                  <Badge
                    variant={
                      result.status === "answered" ? "secondary" : "destructive"
                    }
                  >
                    {result.status === "answered" ? "可回答" : "转工单"}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MetricPill
                    label="引用数"
                    value={String(result.citations.length)}
                  />
                  <MetricPill
                    label="耗时"
                    value={`${result.metrics.latencyMs} ms`}
                  />
                </div>
              </div>
            ) : null}

            {result?.ticket ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
                  <TicketCheck className="h-4 w-4" />
                  工单已创建
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {result.ticket.id}
                </p>
                <p className="mt-3 text-muted-foreground">
                  触发原因：{result.ticket.triggerReason}
                </p>
              </div>
            ) : null}

            {result?.citations.map((citation) => (
              <div
                key={`${result.conversationId}-${citation.label}`}
                className="citation-card p-4 text-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge>
                    <ShieldCheck className="h-3 w-3" />
                    {citation.label}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {citation.similarity.toFixed(3)}
                  </span>
                </div>
                <p className="font-medium">{citation.documentName}</p>
                <p className="mt-2 line-clamp-6 text-muted-foreground">
                  {citation.content}
                </p>
              </div>
            ))}

            {result ? (
              <div className="metric-glass p-4 text-xs text-muted-foreground">
                <div className="grid gap-2">
                  <MetricRow label="Conversation" value={result.conversationId} />
                  <MetricRow
                    label="Top similarity"
                    value={
                      result.metrics.topSimilarity === null
                        ? "null"
                        : result.metrics.topSimilarity.toFixed(3)
                    }
                  />
                  <MetricRow
                    label="Tokens"
                    value={
                      result.metrics.totalTokens === null
                        ? "null"
                        : String(result.metrics.totalTokens)
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
      <span>{label}</span>
      <span className="truncate font-mono text-foreground">{value}</span>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-glass px-3 py-2">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="mt-1 block truncate font-mono text-xs text-foreground">
        {value}
      </span>
    </div>
  );
}
