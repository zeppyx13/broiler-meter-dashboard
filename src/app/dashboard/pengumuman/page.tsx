import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import AnnouncementListSection from "@/components/pengumuman/announcement-list-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function PengumumanPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <AnnouncementListSection />
        </DashboardShell>
    );
}