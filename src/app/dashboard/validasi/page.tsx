import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import ValidationPanel from "@/components/tagihan/validation-panel";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function ValidasiPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />}>
                <ValidationPanel />
            </Suspense>
        </DashboardShell>
    );
}
