"use client";

import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import PeringatanSection from "@/components/peringatan/peringatan-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function PeringatanPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <PeringatanSection />
        </DashboardShell>
    );
}
