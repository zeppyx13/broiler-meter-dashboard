import { Home, Warehouse, FileText, Settings, Cpu, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SidebarIconName } from "@/types/dashboard";

export const NAV_ICONS: Record<SidebarIconName, LucideIcon> = {
    home: Home,
    kandang: Warehouse,
    report: FileText,
    settings: Settings,
    cpu: Cpu,
    terminal: Terminal,
};

export function isNavActive(href: string, pathname: string) {
    return href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === href || pathname.startsWith(href + "/");
}
