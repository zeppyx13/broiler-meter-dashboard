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
    | "messageSquare"   // keluhan
    | "fileCheck"       // kontrak sewa
    | "megaphone"       // pengumuman
    | "sparkles"        // fasilitas
    | "cpu";            // IoT meter

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

export type ComplaintStatus = "open" | "in_progress" | "closed";

export type ComplaintItem = {
    id: number;
    room_id: number;
    title: string;
    status: ComplaintStatus;
    created_at: string;
    closed_at: string | null;
    room_number: string;
    room_floor: number;
};

export type ComplaintMeta = {
    total: number;
    page: number;
    limit: number;
};

export type ComplaintsResponse = {
    success: boolean;
    message: string;
    data: {
        complaints: ComplaintItem[];
        meta: ComplaintMeta;
    };
};