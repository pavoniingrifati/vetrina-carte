import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/shell/Sidebar";
import TopBar from "@/components/shell/TopBar";
import MobileNav from "@/components/shell/MobileNav";

export default function AppShell() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-[258px]">
        <TopBar />
        <main className="mx-auto w-full max-w-[1600px] px-3 pb-24 pt-3 sm:px-5 lg:px-7 lg:pb-10 lg:pt-5">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}