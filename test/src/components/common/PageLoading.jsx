import React from "react";

export default function PageLoading({ label = "Caricamento salvataggio…" }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-club" />
      <p className="font-heading text-xs uppercase tracking-[0.2em]">{label}</p>
    </div>
  );
}