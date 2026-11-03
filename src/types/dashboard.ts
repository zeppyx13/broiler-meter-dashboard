import type { LucideIcon } from "lucide-react";

export type StatItem = {
    title: string;
    value: string;
    desc: string;
    icon: LucideIcon;
};

export type SidebarIconName = "home" | "kandang" | "report" | "settings" | "cpu" | "terminal";

export type SidebarMenuItem = {
    label: string;
    iconName: SidebarIconName;
    href: string;
    group?: "teknis";
    mobile?: boolean;
};
