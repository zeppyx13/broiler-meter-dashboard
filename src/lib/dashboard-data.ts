import type {
    SidebarMenuItem,
} from "@/types/dashboard";

export const sidebarMenus: SidebarMenuItem[] = [
    { label: "Dashboard", iconName: "home", href: "/dashboard" },
    { label: "Kamar", iconName: "bedDouble", href: "/dashboard/kamar" },
    { label: "Penghuni", iconName: "users", href: "/dashboard/penghuni" },
    { label: "Kontrak", iconName: "fileCheck", href: "/dashboard/kontrak" },
    { label: "Tagihan", iconName: "fileText", href: "/dashboard/tagihan" },
    { label: "Pembayaran", iconName: "creditCard", href: "/dashboard/pembayaran" },
    { label: "Keluhan", iconName: "messageSquare", href: "/dashboard/keluhan" },
    { label: "Pengumuman", iconName: "megaphone", href: "/dashboard/pengumuman" },
    { label: "Alat IoT", iconName: "cpu", href: "/dashboard/iot" },
    { label: "IoT Terminal", iconName: "terminal", href: "/dashboard/terminal" },
    { label: "Fasilitas", iconName: "sparkles", href: "/dashboard/fasilitas" },
    { label: "Rating", iconName: "star", href: "/dashboard/rating" },
    { label: "Pengaturan", iconName: "settings", href: "/dashboard/settings" },
];