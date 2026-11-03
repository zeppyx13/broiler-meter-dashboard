// Ambang Guard & preferensi notifikasi. Disimpan lokal (awalan "coasther_" ikut
// dicadangkan); idealnya dipindah ke endpoint pengaturan backend.

export type GuardSettings = {
    waterWarnPct: number;   // air di bawah pola → waspada
    waterCritPct: number;   // air di bawah pola → kritis
    waterLeakPct: number;   // air di atas pola → indikasi bocor
    powerWarnPct: number;   // daya di bawah daya seharusnya → waspada
    powerCritPct: number;   // daya di bawah daya seharusnya → kritis
    offlineMinutes: number; // tanpa data selama ini → perangkat offline
    voltageMin: number;
    voltageMax: number;
    notifyBrowser: boolean;
    notifySound: boolean;
};

// Tegangan: SPLN 220 V, toleransi +5% / −10%.
export const DEFAULT_GUARD_SETTINGS: GuardSettings = {
    waterWarnPct: 10,
    waterCritPct: 25,
    waterLeakPct: 40,
    powerWarnPct: 15,
    powerCritPct: 30,
    offlineMinutes: 2,
    voltageMin: 198,
    voltageMax: 231,
    notifyBrowser: false,
    notifySound: true,
};

const KEY = "coasther_guard_settings";
export const GUARD_SETTINGS_EVENT = "coasther-guard-settings";

export function getGuardSettings(): GuardSettings {
    if (typeof window === "undefined") return DEFAULT_GUARD_SETTINGS;
    try {
        const raw = window.localStorage.getItem(KEY);
        return raw ? { ...DEFAULT_GUARD_SETTINGS, ...JSON.parse(raw) } : DEFAULT_GUARD_SETTINGS;
    } catch {
        return DEFAULT_GUARD_SETTINGS;
    }
}

export function setGuardSettings(settings: GuardSettings) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // abaikan (private mode / storage penuh)
    }
    window.dispatchEvent(new Event(GUARD_SETTINGS_EVENT));
}
