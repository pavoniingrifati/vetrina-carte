import React from "react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, ROLE_PILL } from "@/lib/fantaballa";

export default function RoleTag({ role, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded border px-1.5 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-widest",
        ROLE_PILL[role] || "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      {ROLE_LABEL[role] || role || "—"}
    </span>
  );
}