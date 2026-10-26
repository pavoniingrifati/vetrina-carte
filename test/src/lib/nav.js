import { LayoutDashboard, Users, CalendarDays, ListOrdered, Search } from "lucide-react";

export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/rosa", label: "Rosa", icon: Users },
  { to: "/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/classifica", label: "Classifica", icon: ListOrdered },
  { to: "/giocatori", label: "Database", icon: Search },
];