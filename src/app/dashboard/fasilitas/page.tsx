import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import FacilitySection from "@/components/fasilitas/facility-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function FasilitasPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <FacilitySection />
        </DashboardShell>
    );
}