import type { LucideIcon } from "lucide-react";

export type StatItem = {
    title: string;
    value: string;
    desc: string;
    icon: LucideIcon;
};
export type SidebarIconName =
    | "home"
    | "bedDouble"
    | "users"
    | "fileText"
    | "creditCard"
    | "settings"
    | "messageSquare"   // unused — alert/keluhan module removed
    | "fileCheck"       // siklus produksi
    | "megaphone"       // unused — pengumuman module removed
    | "sparkles"        // komponen kandang
    | "cpu"             // IoT meter
    | "terminal";       // IoT terminal

export type SidebarMenuItem = {
    label: string;
    iconName: SidebarIconName;
    href: string;
};
export type RoomItem = {
    name: string;
    tenant: string;
    status: "Terisi" | "Kosong";
    bill: string;
};

export type ActivityItem = {
    title: string;
    time: string;
};