import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import { AlertsInbox } from "@/components/broiler/insights";
import { sidebarMenus } from "@/lib/dashboard-data";
export default function Page() { return <DashboardShell menus={sidebarMenus}><AlertsInbox /></DashboardShell>; }
