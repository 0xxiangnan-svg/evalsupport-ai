"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DocumentIndexButton({
  documentId,
  disabled,
}: {
  documentId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function indexDocument() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/index`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "索引失败");
      }
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => void indexDocument()}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      Index
    </Button>
  );
}
