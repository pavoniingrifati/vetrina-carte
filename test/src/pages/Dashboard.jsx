import React from "react";
import { useUniverse } from "@/lib/universe-context";
import PageLoading from "@/components/common/PageLoading";
import StatStrip from "@/components/dashboard/StatStrip";
import NextMatchPanel from "@/components/dashboard/NextMatchPanel";
import RecentResultsPanel from "@/components/dashboard/RecentResultsPanel";
import SquadLeadersPanel from "@/components/dashboard/SquadLeadersPanel";
import UpcomingStrip from "@/components/dashboard/UpcomingStrip";
import StandingsPanel from "@/components/dashboard/StandingsPanel";
import ScorersPanel from "@/components/dashboard/ScorersPanel";

export default function Dashboard() {
  const { loading } = useUniverse();

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-3 sm:space-y-4">
      <StatStrip />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-12">
        <div className="space-y-3 sm:space-y-4 xl:col-span-8">
          <NextMatchPanel />
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <RecentResultsPanel />
            <SquadLeadersPanel />
          </div>
          <UpcomingStrip />
        </div>
        <div className="space-y-3 sm:space-y-4 xl:col-span-4">
          <StandingsPanel />
          <ScorersPanel />
        </div>
      </div>
    </div>
  );
}