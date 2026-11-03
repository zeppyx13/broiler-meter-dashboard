import type {
    SidebarMenuItem,
} from "@/types/dashboard";

export const sidebarMenus: SidebarMenuItem[] = [
    { label: "Dashboard", iconName: "home", href: "/dashboard" },
    { label: "Kandang", iconName: "bedDouble", href: "/dashboard/kamar" },
    { label: "Siklus Produksi", iconName: "fileCheck", href: "/dashboard/kontrak" },
    { label: "Laporan Efisiensi", iconName: "fileText", href: "/dashboard/tagihan" },
    { label: "Alat IoT", iconName: "cpu", href: "/dashboard/iot" },
    { label: "IoT Terminal", iconName: "terminal", href: "/dashboard/terminal" },
    { label: "Pengaturan", iconName: "settings", href: "/dashboard/settings" },
];