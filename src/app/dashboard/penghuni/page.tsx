import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import TenantListSection from "@/components/penghuni/tenant-list-section";
// Peternak / PIC kandang management page
import { sidebarMenus } from "@/lib/dashboard-data";

export default function PenghuniPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <TenantListSection />
        </DashboardShell>
    );
}