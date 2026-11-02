import type {
    SidebarMenuItem,
} from "@/types/dashboard";

export const sidebarMenus: SidebarMenuItem[] = [
    { label: "Dashboard", iconName: "home", href: "/dashboard" },
    { label: "Kandang", iconName: "bedDouble", href: "/dashboard/kamar" },
    { label: "Siklus Produksi", iconName: "fileCheck", href: "/dashboard/kontrak" },
    { label: "Laporan Biaya Energi", iconName: "fileText", href: "/dashboard/tagihan" },
    { label: "Alert & Peringatan Dini", iconName: "messageSquare", href: "/dashboard/keluhan" },
    { label: "Alat IoT", iconName: "cpu", href: "/dashboard/iot" },
    { label: "IoT Terminal", iconName: "terminal", href: "/dashboard/terminal" },
    { label: "Komponen Kandang", iconName: "sparkles", href: "/dashboard/fasilitas" },
    { label: "Pengaturan", iconName: "settings", href: "/dashboard/settings" },
];