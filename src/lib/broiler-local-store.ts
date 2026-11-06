// Data khas broiler (populasi, deplesi harian, strain, target panen, daya terpasang,
// angka meter saat chick-in) belum punya kolom di backend (skema backend masih kost).
// Supaya tidak mengirim field tak dikenal ke API nyata, data ini disimpan di browser
// per entitas dan digabung ke data API saat ditampilkan. Data ini per perangkat —
// gunakan Cadangkan/Impor di Pengaturan untuk memindahkannya.

export type EquipmentType = "kipas" | "lampu" | "pemanas" | "pompa" | "lainnya";

export type Equipment = {
    id: string;
    type: EquipmentType;
    name?: string;
    count: number;
    watt: number;
    /** Ikut dihitung sebagai beban yang seharusnya menyala sekarang. */
    active: boolean;
    serverType?: string;
    unit?: string;
    schedule?: { start: string; end: string } | null;
};

export type RoomExtra = {
    population?: number; // lama — dipakai hanya jika siklus belum punya populasi awal
    strain?: string;
    phase_count?: number;
    expected_power_kw?: number; // total manual, dipakai bila daftar peralatan kosong
    equipment?: Equipment[];
};

/** Daya seharusnya (kW): dari peralatan yang aktif, atau total manual bila belum dirinci. */
export function getExpectedPowerKw(extra: RoomExtra): number | undefined {
    if (extra.equipment && extra.equipment.length > 0) {
        const watt = extra.equipment.filter((e) => e.active).reduce((sum, e) => sum + e.count * e.watt, 0);
        return watt > 0 ? watt / 1000 : undefined;
    }
    return extra.expected_power_kw || undefined;
}

export type CycleExtra = {
    population_start?: number;
    strain?: string;
    harvest_target_days?: number;
    // Angka meter kumulatif saat siklus mulai dicatat → konsumsi per siklus.
    baseline_water_liter?: number;
    baseline_energy_kwh?: number;
    baseline_captured_at?: string;
    // Diisi saat Tutup Siklus.
    closed_at?: string;
    harvested_count?: number;
    end_water_liter?: number;
    end_energy_kwh?: number;
};

export type DailyRecord = {
    date: string; // YYYY-MM-DD
    dead: number;
    culled: number;
    avg_weight_g?: number;
    feed_kg?: number;
    note?: string;
};

const STORE_PREFIX = "coasther_";
const ROOM_PREFIX = "coasther_room_extra_";
const CYCLE_PREFIX = "coasther_cycle_extra_";
const RECORDS_PREFIX = "coasther_daily_records_";
const BASELINE_PREFIX = "coasther_daily_baseline_";

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

export function localDateKey(date: Date = new Date(), timezone?: string): string {
    if (timezone) {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
        const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value;
        return `${part("year")}-${part("month")}-${part("day")}`;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ── Kandang ────────────────────────────────────────────────────────────────

export function getRoomExtra(roomId: number): RoomExtra {
    return readJSON<RoomExtra>(`${ROOM_PREFIX}${roomId}`) ?? {};
}

export function setRoomExtra(roomId: number, data: RoomExtra) {
    writeJSON(`${ROOM_PREFIX}${roomId}`, { ...getRoomExtra(roomId), ...data });
}

// ── Siklus ─────────────────────────────────────────────────────────────────

export function getCycleExtra(leaseId: number): CycleExtra {
    return readJSON<CycleExtra>(`${CYCLE_PREFIX}${leaseId}`) ?? {};
}

export function setCycleExtra(leaseId: number, data: CycleExtra) {
    writeJSON(`${CYCLE_PREFIX}${leaseId}`, { ...getCycleExtra(leaseId), ...data });
}

/** Simpan angka meter awal siklus bila belum ada. Return true jika baru disimpan. */
export function ensureCycleBaseline(leaseId: number, waterLiter: number, energyKwh: number): boolean {
    const extra = getCycleExtra(leaseId);
    if (extra.baseline_captured_at) return false;
    setCycleExtra(leaseId, {
        baseline_water_liter: waterLiter,
        baseline_energy_kwh: energyKwh,
        baseline_captured_at: new Date().toISOString(),
    });
    return true;
}

export function getCycleUsage(extra: CycleExtra, currentWaterLiter?: number, currentEnergyKwh?: number) {
    if (!extra.baseline_captured_at || currentWaterLiter == null || currentEnergyKwh == null) return null;
    const endWater = extra.end_water_liter ?? currentWaterLiter;
    const endEnergy = extra.end_energy_kwh ?? currentEnergyKwh;
    const since = new Date(extra.baseline_captured_at);
    const until = extra.closed_at ? new Date(extra.closed_at) : new Date();
    return {
        waterLiter: Math.max(0, endWater - (extra.baseline_water_liter ?? 0)),
        energyKwh: Math.max(0, endEnergy - (extra.baseline_energy_kwh ?? 0)),
        since,
        elapsedDays: Math.max(0, (until.getTime() - since.getTime()) / 86_400_000),
    };
}

// ── Catatan harian (deplesi) ───────────────────────────────────────────────

export function getDailyRecords(leaseId: number): DailyRecord[] {
    const records = readJSON<DailyRecord[]>(`${RECORDS_PREFIX}${leaseId}`) ?? [];
    return [...records].sort((a, b) => b.date.localeCompare(a.date));
}

export function upsertDailyRecord(leaseId: number, record: DailyRecord) {
    const others = getDailyRecords(leaseId).filter((r) => r.date !== record.date);
    writeJSON(`${RECORDS_PREFIX}${leaseId}`, [...others, record]);
}

export function deleteDailyRecord(leaseId: number, date: string) {
    writeJSON(`${RECORDS_PREFIX}${leaseId}`, getDailyRecords(leaseId).filter((r) => r.date !== date));
}

export type CycleState = {
    extra: CycleExtra;
    records: DailyRecord[];
    populationStart?: number;
    depletion: number;
    depletionPct: number | null;
    populationNow?: number;
};

export function getCycleState(leaseId: number, roomId?: number): CycleState {
    const extra = getCycleExtra(leaseId);
    const records = getDailyRecords(leaseId);
    const depletion = records.reduce((sum, r) => sum + (r.dead || 0) + (r.culled || 0), 0);
    const populationStart = extra.population_start;

    let populationNow: number | undefined;
    if (populationStart) populationNow = Math.max(0, populationStart - depletion);
    else if (roomId) populationNow = getRoomExtra(roomId).population;

    return {
        extra,
        records,
        populationStart,
        depletion,
        depletionPct: populationStart ? (depletion / populationStart) * 100 : null,
        populationNow,
    };
}

// ── Pemakaian hari ini ─────────────────────────────────────────────────────
// Meter membaca total kumulatif sejak alat terpasang. "Hari ini" = total sekarang
// dikurangi baseline yang disimpan saat pertama kali ada pembacaan pada hari ini.

type DailyBaseline = { date: string; at?: string; waterLiter: number; energyKwh: number };

export type TodayUsage = {
    waterTodayLiter: number | null;
    energyTodayKwh: number | null;
    since: Date | null; // waktu pembacaan pertama hari ini (bukan selalu tengah malam)
    ready: boolean;
};

export function getTodayUsage(roomId: number, currentWaterLiter?: number, currentEnergyKwh?: number): TodayUsage {
    if (currentWaterLiter == null || currentEnergyKwh == null) {
        return { waterTodayLiter: 0, energyTodayKwh: 0, since: null, ready: false };
    }

    const key = `${BASELINE_PREFIX}${roomId}`;
    const stored = readJSON<DailyBaseline>(key);
    const today = localDateKey();
    const meterReset = stored && (currentWaterLiter < stored.waterLiter || currentEnergyKwh < stored.energyKwh);

    if (!stored || stored.date !== today || meterReset) {
        const now = new Date();
        // Hari berganti: pemakaian kemarin = selisih dari pembacaan pertama kemarin,
        // dinormalkan ke 24 jam (bila jaraknya wajar). Dipakai rasio air : pakan.
        if (stored && stored.date !== today && !meterReset && stored.at) {
            const hours = (now.getTime() - new Date(stored.at).getTime()) / 3_600_000;
            if (hours >= 20 && hours <= 30) recordDailyWater(roomId, stored.date, ((currentWaterLiter - stored.waterLiter) * 24) / hours, false);
        }
        writeJSON(key, { date: today, at: now.toISOString(), waterLiter: currentWaterLiter, energyKwh: currentEnergyKwh });
        return { waterTodayLiter: 0, energyTodayKwh: 0, since: now, ready: true };
    }

    return {
        waterTodayLiter: currentWaterLiter - stored.waterLiter,
        energyTodayKwh: currentEnergyKwh - stored.energyKwh,
        since: stored.at ? new Date(stored.at) : new Date(`${stored.date}T00:00:00`),
        ready: true,
    };
}

// ── Air per hari (untuk rasio air : pakan) ─────────────────────────────────

const DAILY_WATER_PREFIX = "coasther_daily_water_";
const DAILY_WATER_KEEP_DAYS = 90;

/** Liter air per tanggal (YYYY-MM-DD) untuk satu kandang. */
export function getDailyWater(roomId: number): Record<string, number> {
    return readJSON<Record<string, number>>(`${DAILY_WATER_PREFIX}${roomId}`) ?? {};
}

/** Simpan pemakaian air satu hari. `overwrite=false` → tidak menimpa angka yang sudah ada. */
export function recordDailyWater(roomId: number, date: string, liters: number, overwrite = true) {
    if (!Number.isFinite(liters) || liters < 0) return;
    const data = getDailyWater(roomId);
    if (!overwrite && data[date] != null) return;
    data[date] = Math.round(liters * 10) / 10;
    const kept = Object.keys(data).sort().slice(-DAILY_WATER_KEEP_DAYS);
    writeJSON(`${DAILY_WATER_PREFIX}${roomId}`, Object.fromEntries(kept.map((d) => [d, data[d]])));
}

// ── Cadangan ───────────────────────────────────────────────────────────────

export function exportLocalData(): string {
    const data: Record<string, unknown> = {};
    if (typeof window !== "undefined") {
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key?.startsWith(STORE_PREFIX)) data[key] = readJSON(key);
        }
    }
    return JSON.stringify({ app: "coasther", exported_at: new Date().toISOString(), data }, null, 2);
}

/** Return jumlah entri yang diimpor. Lempar error jika format tidak dikenali. */
export function importLocalData(json: string): number {
    const parsed = JSON.parse(json);
    if (parsed?.app !== "coasther" || typeof parsed.data !== "object") {
        throw new Error("File bukan cadangan Coasther.");
    }
    const entries = Object.entries(parsed.data as Record<string, unknown>).filter(([key]) => key.startsWith(STORE_PREFIX));
    entries.forEach(([key, value]) => writeJSON(key, value));
    return entries.length;
}
