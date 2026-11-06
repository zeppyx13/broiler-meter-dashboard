import type { LoggedAlert } from "@/lib/alert-log";

const TIER_LABEL = { kritis: "KRITIS", waspada: "WASPADA", info: "INFO" } as const;

export function notificationSupported() {
    return typeof window !== "undefined" && "Notification" in window;
}

export function showAlertNotification(alert: Pick<LoggedAlert, "key" | "tier" | "roomNumber" | "title" | "action" | "roomId">) {
    if (!notificationSupported() || Notification.permission !== "granted") return;
    try {
        const n = new Notification(`${TIER_LABEL[alert.tier]} · Kandang ${alert.roomNumber}`, {
            body: `${alert.title}. ${alert.action}`,
            tag: alert.key,
            icon: "/coasther.png",
        });
        n.onclick = () => {
            window.focus();
            window.location.assign(new URL(`/dashboard/kamar/${alert.roomId}`, window.location.origin));
        };
    } catch {
        // beberapa browser mobile hanya mengizinkan notifikasi lewat service worker
    }
}

/** Tiga bunyi pendek. Browser bisa menahan audio sebelum ada interaksi pengguna. */
export function playAlertSound() {
    if (typeof window === "undefined") return;
    try {
        const ctx = new AudioContext();
        [0, 0.35, 0.7].forEach((offset) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "square";
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.08, ctx.currentTime + offset);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.25);
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + offset);
            osc.stop(ctx.currentTime + offset + 0.25);
        });
        setTimeout(() => ctx.close(), 1500);
    } catch {
        // audio tidak tersedia
    }
}
