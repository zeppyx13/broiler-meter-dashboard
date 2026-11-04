export type SidebarIconName = "home" | "kandang" | "alert" | "report" | "settings" | "cpu" | "terminal";

export type SidebarMenuItem = {
    label: string;
    iconName: SidebarIconName;
    href: string;
    group?: "teknis";
    mobile?: boolean;
    /** Tampilkan jumlah peringatan yang belum dicek. */
    alertBadge?: boolean;
};
