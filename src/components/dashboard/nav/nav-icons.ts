import { Home, Warehouse, BellRing, FileText, Settings, Cpu, Terminal, ClipboardCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SidebarIconName } from "@/types/dashboard";

export const NAV_ICONS: Record<SidebarIconName, LucideIcon> = {
    home: Home,
    kandang: Warehouse,
    alert: BellRing,
    report: FileText,
    settings: Settings,
    cpu: Cpu,
    terminal: Terminal,
    validasi: ClipboardCheck,
};

export function isNavActive(href: string, pathname: string) {
    return href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === href || pathname.startsWith(href + "/");
}
