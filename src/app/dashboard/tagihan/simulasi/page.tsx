import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import RoiSimulation from "@/components/tagihan/roi-simulation";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function RoiSimulationPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />}>
                <RoiSimulation />
            </Suspense>
        </DashboardShell>
    );
}
