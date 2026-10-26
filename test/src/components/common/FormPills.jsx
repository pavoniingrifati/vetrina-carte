import React from "react";
import { cn } from "@/lib/utils";
import { RESULT_LETTER, RESULT_PILL } from "@/lib/fantaballa";

export default function FormPills({ form = [], size = "md", className }) {
  if (!form.length) {
    return <span className={cn("font-heading text-sm tracking-widest text-muted-foreground", className)}>—</span>;
  }
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[...form].reverse().map((result, index) => (
        <span
          key={`${result.date}-${index}`}
          title={`${result.date} · ${result.goals}-${result.against} vs ${result.opponent}`}
          className={cn(
            "inline-flex items-center justify-center rounded border font-heading font-bold leading-none",
            RESULT_PILL[result.kind],
            size === "sm" ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-[11px]"
          )}
        >
          {RESULT_LETTER[result.kind]}
        </span>
      ))}
    </div>
  );
}