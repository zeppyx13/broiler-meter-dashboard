import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import { CoopsPage } from "@/components/broiler/dashboard";
import { sidebarMenus } from "@/lib/dashboard-data";
export default function Page() { return <DashboardShell menus={sidebarMenus}><CoopsPage /></DashboardShell>; }
