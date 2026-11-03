import type { SidebarMenuItem } from "@/types/dashboard";

export const sidebarMenus: SidebarMenuItem[] = [
    { label: "Beranda", iconName: "home", href: "/dashboard", mobile: true },
    { label: "Kandang", iconName: "kandang", href: "/dashboard/kamar", mobile: true },
    { label: "Laporan", iconName: "report", href: "/dashboard/tagihan", mobile: true },
    { label: "Pengaturan", iconName: "settings", href: "/dashboard/settings", mobile: true },
    { label: "Alat IoT", iconName: "cpu", href: "/dashboard/iot", group: "teknis" },
    { label: "IoT Terminal", iconName: "terminal", href: "/dashboard/terminal", group: "teknis" },
];
