"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export function SearchBox({ defaultValue = "", className }: { defaultValue?: string; className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = React.useState(defaultValue);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={cn(
        "flex w-full max-w-xl items-center gap-2 rounded-xl border border-border bg-background p-1.5 shadow-sm",
        className
      )}
    >
      <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.hero.placeholder}
        aria-label={t.hero.placeholder}
        minLength={2}
        maxLength={100}
        className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <Button type="submit" size="lg">
        {t.hero.search}
      </Button>
    </form>
  );
}
