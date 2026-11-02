import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import LeaseListSection from "@/components/kontrak/lease-list-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function KontrakPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <LeaseListSection />
        </DashboardShell>
    );
}