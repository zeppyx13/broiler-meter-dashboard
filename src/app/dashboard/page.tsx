"use client";

import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import BerandaOverview from "@/components/dashboard/home/beranda-overview";
import GuardSection from "@/components/dashboard/guard/guard-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function BerandaPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <BerandaOverview />
            <GuardSection />
        </DashboardShell>
    );
}
