import type { SidebarMenuItem } from "@/types/dashboard";

export const sidebarMenus: SidebarMenuItem[] = [
    { label: "Beranda", iconName: "home", href: "/dashboard", mobile: true },
    { label: "Kandang", iconName: "kandang", href: "/dashboard/kamar", mobile: true },
    { label: "Peringatan", iconName: "alert", href: "/dashboard/peringatan", mobile: true, alertBadge: true },
    { label: "Laporan", iconName: "report", href: "/dashboard/tagihan", mobile: true },
    // Di mobile, Pengaturan & menu Teknis ada di tombol "Lainnya" pada navigasi bawah.
    { label: "Pengaturan", iconName: "settings", href: "/dashboard/settings" },
    { label: "Alat IoT", iconName: "cpu", href: "/dashboard/iot", group: "teknis" },
    { label: "IoT Terminal", iconName: "terminal", href: "/dashboard/terminal", group: "teknis" },
];
