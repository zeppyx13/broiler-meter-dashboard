import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import EfficiencyReportGenerator from "@/components/tagihan/efficiency-report-generator";
import ImpactCard from "@/components/tagihan/impact-card";
import MonthlyEfficiencyChart from "@/components/dashboard/home/monthly-efficiency";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function TagihanPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            {/* useSearchParams (?kandang=) butuh batas Suspense agar halaman tetap bisa di-prerender.
                Kartu lain ikut di dalamnya karena membaca data lokal browser. */}
            <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl border border-[#EAEAEA] bg-white" />}>
                <EfficiencyReportGenerator />
                <MonthlyEfficiencyChart />
                <ImpactCard />
            </Suspense>
        </DashboardShell>
    );
}
