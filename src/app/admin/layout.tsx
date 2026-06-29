import Link from "next/link";
import { BarChart3, FileText, Inbox, MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/admin/tickets", label: "Tickets", icon: Inbox },
  { href: "/admin/evals", label: "Evals", icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-[1440px] gap-5 px-4 py-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-2xl border border-border/80 bg-card/75 p-4 shadow-[0_18px_80px_rgba(0,0,0,0.16)] backdrop-blur lg:min-h-[calc(100dvh-2rem)]">
          <div className="flex items-center justify-between lg:block">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                ES
              </span>
              <span>
                <span className="block text-sm font-semibold">EvalSupport AI</span>
                <span className="block text-xs text-muted-foreground">
                  Admin console
                </span>
              </span>
            </Link>
            <Button asChild variant="secondary" size="sm" className="lg:hidden">
              <Link href="/">Chat</Link>
            </Button>
          </div>
          <Separator className="my-4" />
          <nav className="grid gap-2">
            {navItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className="h-10 justify-start"
              >
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <Button asChild variant="secondary" className="mt-6 hidden w-full lg:inline-flex">
            <Link href="/">返回问答</Link>
          </Button>
        </aside>
        <section className="min-w-0 rounded-2xl border border-border/70 bg-card/45 p-4 backdrop-blur sm:p-6">
          {children}
        </section>
      </div>
    </main>
  );
}
