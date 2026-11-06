import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import { IotOperations } from "@/components/broiler/operations";
import { sidebarMenus } from "@/lib/dashboard-data";
export default function Page() { return <DashboardShell menus={sidebarMenus}><IotOperations /></DashboardShell>; }
