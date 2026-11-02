import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import ComplaintListSection from "@/components/keluhan/complaint-list-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function KeluhanPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <ComplaintListSection />
        </DashboardShell>
    );
}