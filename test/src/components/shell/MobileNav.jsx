import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export default function MobileNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Navigazione principale"
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                isActive ? "text-club" : "text-muted-foreground active:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-club" /> : null}
                <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.9} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}