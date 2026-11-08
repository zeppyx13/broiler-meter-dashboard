import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import TeamAccessCard from "@/components/settings/team-access";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function TeamPage() {
    return <DashboardShell menus={sidebarMenus}><TeamAccessCard /></DashboardShell>;
}
