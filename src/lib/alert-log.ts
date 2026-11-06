import type { AlertTier } from "@/lib/kandang-insights";

// Satu episode peringatan Guard (dari server) dalam bentuk yang dipakai halaman Peringatan.

export type LoggedAlert = {
    key: string; // `${roomId}:${alertId}`
    roomId: number;
    roomNumber: string;
    alertId: string;
    tier: AlertTier;
    title: string;
    detail: string;
    action: string;
    firstSeen: string;
    lastSeen: string;
    resolvedAt?: string;
    acknowledgedAt?: string;
    /**
     * Detik dari data alat ke peringatan muncul. Untuk "offline" = lama tanpa data
     * sampai Guard menyimpulkan perangkat/listrik mati. Hanya untuk aturan seketika.
     */
    detectionSec?: number;
    /** ID alert di backend (untuk ack / resolve). */
    serverId?: number;
};
