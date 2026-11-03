import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import EfficiencyReportGenerator from "@/components/tagihan/efficiency-report-generator";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function TagihanPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <EfficiencyReportGenerator />
        </DashboardShell>
    );
}
