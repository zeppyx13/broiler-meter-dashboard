import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import { SettingsOperations } from "@/components/broiler/operations";
import { sidebarMenus } from "@/lib/dashboard-data";
export default function Page() { return <DashboardShell menus={sidebarMenus}><SettingsOperations /></DashboardShell>; }
