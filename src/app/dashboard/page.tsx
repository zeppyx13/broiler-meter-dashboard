import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import { HomeOverview } from "@/components/broiler/dashboard";
import { sidebarMenus } from "@/lib/dashboard-data";
export default function Page() { return <DashboardShell menus={sidebarMenus}><HomeOverview /></DashboardShell>; }
