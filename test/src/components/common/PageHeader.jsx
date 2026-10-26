import React from "react";
import { cn } from "@/lib/utils";

export default function PageHeader({ title, subtitle, children, className }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold uppercase leading-none tracking-[0.14em] sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px]">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}