// Field-field khas broiler (populasi, strain, target panen, daya terpasang) belum
// ada kolomnya di backend (backend masih skema kost). Supaya tidak mengirim field
// tak dikenal ke API nyata (berisiko ditolak backend), nilai-nilai ini disimpan
// lokal di browser per entitas, dan digabung ke data dari API saat ditampilkan.
// Catatan: ini data lokal per perangkat/browser, bukan data yang disinkron ke server.

export type RoomExtra = {
    population?: number;
    strain?: string;
    phase_count?: number;
    expected_power_kw?: number;
};

export type CycleExtra = {
    population_start?: number;
    strain?: string;
    harvest_target_days?: number;
};

const ROOM_PREFIX = "coasther_room_extra_";
const CYCLE_PREFIX = "coasther_cycle_extra_";

function readJSON<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

function writeJSON(key: string, value: unknown) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // abaikan (private mode / storage penuh)
    }
}

export function getRoomExtra(roomId: number): RoomExtra {
    return readJSON<RoomExtra>(`${ROOM_PREFIX}${roomId}`) ?? {};
}

export function setRoomExtra(roomId: number, data: RoomExtra) {
    const current = getRoomExtra(roomId);
    writeJSON(`${ROOM_PREFIX}${roomId}`, { ...current, ...data });
}

export function getCycleExtra(leaseId: number): CycleExtra {
    return readJSON<CycleExtra>(`${CYCLE_PREFIX}${leaseId}`) ?? {};
}

export function setCycleExtra(leaseId: number, data: CycleExtra) {
    const current = getCycleExtra(leaseId);
    writeJSON(`${CYCLE_PREFIX}${leaseId}`, { ...current, ...data });
}

// Meter nyata membaca TOTAL kumulatif (sejak alat terpasang), bukan "hari ini".
// Untuk mendapatkan angka "hari ini" yang jujur (bukan rekaan), kita simpan
// baseline kumulatif lokal pada tengah malam hari ini (per kandang), lalu
// "hari ini" = total sekarang - baseline. Baseline hanya ter-reset saat
// dashboard dibuka pada hari berjalan.
type DailyBaseline = {
    date: string; // YYYY-MM-DD
    waterLiter: number;
    energyKwh: number;
};

const BASELINE_PREFIX = "coasther_daily_baseline_";

function todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getTodayUsage(roomId: number, currentWaterLiter: number, currentEnergyKwh: number): {
    waterTodayLiter: number;
    energyTodayKwh: number;
} {
    const key = `${BASELINE_PREFIX}${roomId}`;
    const stored = readJSON<DailyBaseline>(key);
    const today = todayKey();

    if (!stored || stored.date !== today) {
        const fresh: DailyBaseline = { date: today, waterLiter: currentWaterLiter, energyKwh: currentEnergyKwh };
        writeJSON(key, fresh);
        return { waterTodayLiter: 0, energyTodayKwh: 0 };
    }

    return {
        waterTodayLiter: Math.max(0, currentWaterLiter - stored.waterLiter),
        energyTodayKwh: Math.max(0, currentEnergyKwh - stored.energyKwh),
    };
}
