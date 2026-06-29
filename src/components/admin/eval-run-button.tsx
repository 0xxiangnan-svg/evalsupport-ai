"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EvalRunButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function runEval() {
    setIsLoading(true);
    try {
      await fetch("/api/evals/run", { method: "POST" });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button onClick={() => void runEval()} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <PlayCircle className="h-4 w-4" />
      )}
      运行 Eval
    </Button>
  );
}
