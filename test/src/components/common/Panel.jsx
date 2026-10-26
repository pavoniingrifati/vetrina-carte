import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Panel({ title, icon: Icon, action, actionTo, actionLabel = "Apri", caption, children, className, bodyClassName }) {
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card/80 backdrop-blur-sm", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-club" strokeWidth={2.2} /> : null}
          <h2 className="truncate font-heading text-[15px] font-semibold uppercase tracking-[0.16em] text-foreground">{title}</h2>
        </div>
        {actionTo ? (
          <Link
            to={actionTo}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-white/5 hover:text-club"
          >
            {actionLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          action || null
        )}
      </header>
      {caption ? <p className="px-4 pt-2 text-[11px] uppercase tracking-wider text-muted-foreground">{caption}</p> : null}
      <div className={cn("flex-1", bodyClassName || "p-3 sm:p-4")}>{children}</div>
    </section>
  );
}