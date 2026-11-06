import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import { ReportsPage } from "@/components/broiler/reports";
import { sidebarMenus } from "@/lib/dashboard-data";
export default function Page() { return <DashboardShell menus={sidebarMenus}><ReportsPage /></DashboardShell>; }
