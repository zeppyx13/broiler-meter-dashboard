export type LogLevel = "INFO" | "WARN" | "ERROR" | "SYSTEM";

export type LogEntry = {
    id: string;
    level: LogLevel;
    msg: string;
    ts: string;
    source: "mqtt" | "system";
};

export type CommandDef = {
    cmd: string;
    label: string;
    desc: string;
    danger?: boolean;
};

export const LEVEL_STYLE: Record<LogLevel, { dot: string; text: string }> = {
    INFO: { dot: "bg-emerald-400", text: "text-emerald-300" },
    WARN: { dot: "bg-amber-400", text: "text-amber-300" },
    ERROR: { dot: "bg-red-400", text: "text-red-300" },
    SYSTEM: { dot: "bg-blue-400", text: "text-blue-300" },
};

export const NORMAL_COMMANDS: CommandDef[] = [
    { cmd: "status", label: "Status", desc: "Cek kondisi ESP32 sekarang" },
    { cmd: "sync_ntp", label: "Sync NTP", desc: "Sinkronisasi waktu dari NTP" },
    { cmd: "relay_on", label: "Relay ON", desc: "Nyalakan relay (air mengalir)" },
    { cmd: "relay_off", label: "Relay OFF", desc: "Matikan relay (air diputus)" },
    { cmd: "clear_buf", label: "Clear Buffer", desc: "Bersihkan offline buffer" },
];

export const DANGER_COMMANDS: CommandDef[] = [
    { cmd: "reset_nvs", label: "Reset NVS", desc: "Reset semua counter air & kWh ke 0", danger: true },
    { cmd: "reboot", label: "Reboot", desc: "Restart ESP32 dari jauh", danger: true },
];

export function generateId(): string {
    return Math.random().toString(36).slice(2, 9);
}

export function formatTs(ts: string): string {
    try {
        return new Date(ts).toLocaleTimeString("id-ID", {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        });
    } catch {
        return ts;
    }
}