"use client";

import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import ChartPlaceholder from "@/components/dashboard/chart/chart-placeholder";
import ComplaintsSection from "@/components/dashboard/complaint/complaints-section";
import RoomsSection from "@/components/dashboard/rooms/rooms-section";
import DashboardStatsSection from "@/components/dashboard/stat/dashboard-stats-section";
import {
    sidebarMenus,
} from "@/lib/dashboard-data";
import SummarySection from "@/components/dashboard/Summary/summary-section";

export default function AdminDashboardPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <DashboardStatsSection />

            <section className="grid gap-6 xl:grid-cols-3">
                <ChartPlaceholder />
                <ComplaintsSection />
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
                <RoomsSection />
                <SummarySection />
            </section>
        </DashboardShell>
    );
}