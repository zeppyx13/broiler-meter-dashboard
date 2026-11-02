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
import GuardSection from "@/components/dashboard/guard/guard-section";
import ForecastSection from "@/components/dashboard/forecast/forecast-section";
import EcoAdvisorSection from "@/components/dashboard/eco-advisor/eco-advisor-section";

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

            <section className="grid gap-6 xl:grid-cols-2">
                <GuardSection />
                <ForecastSection />
            </section>

            <section className="grid gap-6">
                <EcoAdvisorSection />
            </section>
        </DashboardShell>
    );
}