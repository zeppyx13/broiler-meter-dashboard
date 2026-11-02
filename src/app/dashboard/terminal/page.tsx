import DashboardShell from "@/components/dashboard/nav/dashboard-shell";
import IotTerminalSection from "@/components/terminal/iot-terminal-section";
import { sidebarMenus } from "@/lib/dashboard-data";

export default function IotTerminalPage() {
    return (
        <DashboardShell menus={sidebarMenus}>
            <IotTerminalSection />
        </DashboardShell>
    );
}