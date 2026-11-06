import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import { TerminalOperations } from "@/components/broiler/operations";
import { sidebarMenus } from "@/lib/dashboard-data";
export default function Page() { return <DashboardShell menus={sidebarMenus}><TerminalOperations /></DashboardShell>; }
