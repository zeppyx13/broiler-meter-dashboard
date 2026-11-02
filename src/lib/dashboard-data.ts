import type {
    SidebarMenuItem,
} from "@/types/dashboard";

export const sidebarMenus: SidebarMenuItem[] = [
    { label: "Dashboard", iconName: "home", href: "/dashboard" },
    { label: "Kandang", iconName: "bedDouble", href: "/dashboard/kamar" },
    { label: "Peternak", iconName: "users", href: "/dashboard/penghuni" },
    { label: "Siklus Produksi", iconName: "fileCheck", href: "/dashboard/kontrak" },
    { label: "Laporan Biaya Energi", iconName: "fileText", href: "/dashboard/tagihan" },
    { label: "Pembayaran", iconName: "creditCard", href: "/dashboard/pembayaran" },
    { label: "Alert & Peringatan Dini", iconName: "messageSquare", href: "/dashboard/keluhan" },
    { label: "Pengumuman", iconName: "megaphone", href: "/dashboard/pengumuman" },
    { label: "Alat IoT", iconName: "cpu", href: "/dashboard/iot" },
    { label: "IoT Terminal", iconName: "terminal", href: "/dashboard/terminal" },
    { label: "Komponen Kandang", iconName: "sparkles", href: "/dashboard/fasilitas" },
    { label: "Pengaturan", iconName: "settings", href: "/dashboard/settings" },
];