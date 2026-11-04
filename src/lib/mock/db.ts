// "Database" backend tiruan untuk mode demo, disimpan di localStorage browser.
// Saat pertama dibuka, data dibuat seolah peternakan UMKM sudah berjalan beberapa
// bulan: 4 kandang ratusan ekor (3 sedang siklus, 1 istirahat), riwayat siklus sebelumnya,
// catatan harian, peralatan, dan angka meter yang konsisten dengan simulasi.

import type { Room } from "@/types/room";
import type { Lease } from "@/types/lease";
import type { Meter } from "@/types/meter";
import type { Tenant } from "@/types/tenant";
import type { Tariff } from "@/lib/tariff-api";
import { getExpectedPowerKw, localDateKey, type CycleExtra, type DailyRecord, type RoomExtra } from "@/lib/broiler-local-store";
import { seedAlertHistory, seedCalibrations } from "./seed-events";
import {
    DAY_MS, advanceDevice, ageAt, cumulativeMortality, mulberry32, round, templateEquipment,
    type CycleCtx, type DeviceState, type SimState,
} from "./simulator";

const DB_KEY = "coasther-demo-db";
const SIM_KEY = "coasther-demo-sim";
/** Data lokal milik backend asli yang disisihkan saat demo pertama kali dibuat. */
export const BACKUP_KEY = "coasther-backup-before-demo";
// Naikkan bila bentuk data seed berubah → data demo dibuat ulang.
const DEMO_VERSION = 3;

export type DemoDB = {
    version: number;
    rooms: Room[];
    leases: Lease[];
    meters: Meter[];
    tariff: Tariff;
    users: Tenant[];
    seq: { room: number; lease: number; meter: number };
};

// ── Penyimpanan ────────────────────────────────────────────────────────────

function read<T>(key: string): T | null {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

function write(key: string, value: unknown) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // abaikan (storage penuh)
    }
}

let cachedDB: DemoDB | null = null;
let cachedSim: SimState | null = null;

export function getDB(): DemoDB {
    if (cachedDB) return cachedDB;
    const stored = read<DemoDB>(DB_KEY);
    if (stored?.version === DEMO_VERSION && read<SimState>(SIM_KEY)) {
        cachedDB = stored;
        return stored;
    }
    seed();
    return cachedDB!;
}

export function saveDB() {
    if (cachedDB) write(DB_KEY, cachedDB);
}

export function getSim(): SimState {
    getDB();
    if (!cachedSim) cachedSim = read<SimState>(SIM_KEY) ?? { devices: {} };
    return cachedSim;
}

export function saveSim() {
    if (cachedSim) write(SIM_KEY, cachedSim);
}

/** Hapus semua data demo & data lokal broiler, lalu buat ulang dari awal. */
export function resetDemo() {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        // Cadangan data backend asli (coasther-backup-before-demo) tidak ikut dihapus.
        if (key && (key.startsWith("coasther_") || key.startsWith("coasther-demo"))) keys.push(key);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
    try {
        for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
            const key = window.sessionStorage.key(i);
            if (key?.startsWith("coasther-rt-")) window.sessionStorage.removeItem(key);
        }
    } catch {
        // abaikan
    }
    cachedDB = null;
    cachedSim = null;
    seed();
}

export const DEMO_USER: Tenant = {
    id: 1,
    name: "Made Wirawan",
    email: "demo@coasther.id",
    phone: "081234567890",
    role: "admin",
    created_at: "2026-03-01T08:00:00.000Z",
    updated_at: "2026-03-01T08:00:00.000Z",
};

// ── Seed ───────────────────────────────────────────────────────────────────

type KandangPlan = {
    id: number;
    number: string;
    floor: number;
    image: string;
    description: string;
    strain: string;
    population: number;
    target: number;
    /** Hari umur siklus berjalan, atau null bila sedang istirahat. */
    activeAge: number | null;
    /** Kandang istirahat: hari sejak panen terakhir. */
    restingDays?: number;
    meterStart: { water: number; energy: number };
};

// Skala UMKM: kandang panggung/postal berisi ratusan ekor (kepadatan ±8–10 ekor/m²),
// listrik rumah tangga 1.300–2.200 VA untuk seluruh kandang.
const PLANS: KandangPlan[] = [
    {
        id: 1, number: "A01", floor: 1, image: "broiler-grower-house.jpg",
        description: "Kandang panggung bambu 6 × 10 m, kapasitas ±600 ekor.",
        strain: "Cobb 500", population: 600, target: 35, activeAge: 23,
        meterStart: { water: 9_850, energy: 640 },
    },
    {
        id: 2, number: "A02", floor: 1, image: "broiler-flock.jpg",
        description: "Kandang panggung 5 × 7 m, kapasitas ±350 ekor.",
        strain: "Ross 308", population: 350, target: 33, activeAge: 31,
        meterStart: { water: 6_200, energy: 410 },
    },
    {
        id: 3, number: "B01", floor: 2, image: "broiler-closed-house.jpg",
        description: "Kandang postal lantai sekam 4 × 6 m, brooder bohlam.",
        strain: "Cobb 500", population: 250, target: 35, activeAge: 9,
        meterStart: { water: 4_100, energy: 290 },
    },
    {
        id: 4, number: "B02", floor: 2, image: "poultry-commercial-farm.jpg",
        description: "Kandang panggung 5 × 8 m. Sedang istirahat & sanitasi.",
        strain: "Ross 308", population: 400, target: 34, activeAge: null, restingDays: 5,
        meterStart: { water: 7_300, energy: 480 },
    },
];

// Bobot rata-rata Cobb/Ross (gram) menurut hari umur, diinterpolasi.
const WEIGHT_TABLE: [number, number][] = [[0, 42], [7, 185], [14, 480], [21, 960], [28, 1520], [35, 2150], [42, 2750]];

function weightAt(age: number) {
    for (let i = 1; i < WEIGHT_TABLE.length; i++) {
        const [d1, w1] = WEIGHT_TABLE[i];
        const [d0, w0] = WEIGHT_TABLE[i - 1];
        if (age <= d1) return w0 + ((w1 - w0) * (age - d0)) / (d1 - d0);
    }
    return WEIGHT_TABLE[WEIGHT_TABLE.length - 1][1];
}

/** Konsumsi pakan (gram/ekor/hari) — kumulatif ±3,2 kg/ekor sampai hari 35. */
function feedIntakeG(age: number) {
    return 10 + 4.6 * age;
}

type PlannedCycle = {
    leaseId: number;
    room: KandangPlan;
    startMs: number;
    endMs: number | null; // null = berjalan
    population: number;
    strain: string;
    target: number;
    perf: number; // 0,95–1,05: variasi kinerja antar siklus
};

function dateKey(ms: number) {
    return localDateKey(new Date(ms));
}

/** Tanggal lokal (YYYY-MM-DD) dibaca sebagai tengah malam UTC, sama seperti hitungan umur di frontend. */
function chickInMs(daysAgo: number, now: number) {
    return Date.parse(dateKey(now - daysAgo * DAY_MS));
}

function planCycles(now: number): PlannedCycle[] {
    const cycles: Omit<PlannedCycle, "leaseId">[] = [];
    PLANS.forEach((room) => {
        const rand = mulberry32(room.id * 97);
        let nextStart: number;
        let completed = 2;

        if (room.activeAge != null) {
            const start = chickInMs(room.activeAge, now);
            cycles.push({ room, startMs: start, endMs: null, population: room.population, strain: room.strain, target: room.target, perf: 1 });
            nextStart = start;
        } else {
            nextStart = now - (room.restingDays ?? 5) * DAY_MS + 14 * DAY_MS; // seolah siklus berikut mulai 14 hari setelah panen
            completed = 3;
        }

        for (let i = 0; i < completed; i++) {
            const rest = (13 + Math.floor(rand() * 4)) * DAY_MS;
            const length = 32 + Math.floor(rand() * 5);
            const endMs = Date.parse(dateKey(nextStart - rest)) + 9 * 3_600_000;
            const startMs = Date.parse(dateKey(endMs - length * DAY_MS));
            cycles.push({
                room,
                startMs,
                endMs,
                population: Math.round((room.population * (0.9 + rand() * 0.15)) / 10) * 10,
                strain: i % 2 === 0 ? room.strain : room.strain === "Cobb 500" ? "Ross 308" : "Cobb 500",
                target: room.target,
                perf: 0.95 + rand() * 0.1,
            });
            nextStart = startMs;
        }
    });

    return cycles
        .sort((a, b) => a.startMs - b.startMs)
        .map((c, i) => ({ ...c, leaseId: i + 1 }));
}

function makeRecords(c: PlannedCycle, now: number): DailyRecord[] {
    const rand = mulberry32(c.leaseId * 7919);
    const lastDay = c.endMs != null ? ageAt(c.startMs, c.endMs) : ageAt(c.startMs, now) - 1;
    const records: DailyRecord[] = [];
    let alive = c.population;
    // Jumlah kecil (rata-rata < 1 ekor/hari) diundi agar totalnya tetap sesuai rata-rata.
    const draw = (expected: number) => Math.floor(expected) + (rand() < expected - Math.floor(expected) ? 1 : 0);
    for (let d = 1; d <= lastDay; d++) {
        // Open house skala kecil: kematian minggu pertama lebih tinggi (±3–6% per siklus).
        const rate = d <= 7 ? 0.003 : d <= 14 ? 0.0012 : 0.0008;
        const dead = draw(alive * rate * (0.5 + rand()) * (2 - c.perf));
        const culled = d > 7 ? draw(alive * 0.0003 * (0.5 + rand())) : 0;
        alive -= dead + culled;
        const isFinal = c.endMs != null && d === lastDay;
        const record: DailyRecord = {
            date: dateKey(c.startMs + d * DAY_MS),
            dead,
            culled,
            // Pakan ditimbang per setengah kilo (karung 50 kg dibagi ember takar).
            feed_kg: Math.round(((feedIntakeG(d) * alive * (1.02 - (c.perf - 1) * 0.6)) / 1000) * 2) / 2,
        };
        if (d % 7 === 0 || isFinal) record.avg_weight_g = Math.round(weightAt(d) * c.perf * (0.98 + rand() * 0.04));
        if (dead >= Math.max(3, alive * 0.005)) record.note = "Kematian di atas biasa, sudah dicek suhu brooder & tempat minum.";
        records.push(record);
    }
    return records;
}

function seed() {
    const now = Date.now();
    const origin = window.location.origin;
    const planned = planCycles(now);

    // Data lokal dari backend asli (id-nya bisa bentrok dengan data demo) dipindah
    // ke satu kunci cadangan, bukan dibuang. Format sama dengan file Cadangkan.
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && /^coasther_(room_extra|cycle_extra|daily_records|daily_baseline|daily_water|alert_log|calibration)/.test(key)) stale.push(key);
    }
    if (stale.length > 0 && !window.localStorage.getItem(BACKUP_KEY)) {
        const data = Object.fromEntries(stale.map((k) => [k, read(k)]));
        write(BACKUP_KEY, { app: "coasther", exported_at: new Date().toISOString(), data });
    }
    stale.forEach((k) => window.localStorage.removeItem(k));

    const rooms: Room[] = PLANS.map((p) => ({
        id: p.id,
        number: p.number,
        floor: p.floor,
        price_monthly: 1,
        deposit: 0,
        is_available: true,
        description: p.description,
        main_image_url: `${origin}/backgrounds/${p.image}`,
        is_occupied: p.activeAge != null,
        created_at: "2026-03-01T08:00:00.000Z",
        updated_at: "2026-03-01T08:00:00.000Z",
        facilities: [],
    }));

    const leases: Lease[] = planned.map((c) => ({
        id: c.leaseId,
        user_id: DEMO_USER.id,
        room_id: c.room.id,
        start_date: dateKey(c.startMs),
        end_date: c.endMs != null ? dateKey(c.endMs) : null,
        status: c.endMs != null ? "ended" : "active",
        monthly_rent_snapshot: 1,
        note: null,
        created_at: new Date(c.startMs).toISOString(),
        updated_at: new Date(c.endMs ?? c.startMs).toISOString(),
        tenant_name: DEMO_USER.name,
        tenant_email: DEMO_USER.email,
        room_number: c.room.number,
        room_floor: c.room.floor,
    }));

    // Catatan harian & data siklus.
    planned.forEach((c) => {
        const records = makeRecords(c, now);
        write(`coasther_daily_records_${c.leaseId}`, records);
        const depletion = records.reduce((s, r) => s + r.dead + r.culled, 0);
        const extra: CycleExtra = { population_start: c.population, strain: c.strain, harvest_target_days: c.target };
        if (c.endMs != null) {
            extra.closed_at = new Date(c.endMs).toISOString();
            extra.harvested_count = c.population - depletion;
        }
        write(`coasther_cycle_extra_${c.leaseId}`, extra);
    });

    // Peralatan sesuai umur siklus berjalan (kandang istirahat: templat umur 0, semua padam kecuali pompa).
    PLANS.forEach((p) => {
        // Kandang istirahat: daftar peralatan tetap ada, semuanya padam.
        const equipment = templateEquipment(p.population, p.activeAge ?? 0).map((e) => (p.activeAge == null ? { ...e, active: false } : e));
        const extra: RoomExtra = { phase_count: 1, equipment };
        write(`coasther_room_extra_${p.id}`, extra);
    });

    // Jalankan meter dari jauh sebelum siklus pertama sampai sekarang, sambil
    // mencatat angka meter saat chick-in & panen tiap siklus.
    const devices: Record<string, DeviceState> = {};
    const firstStart = Math.min(...planned.map((c) => c.startMs));
    PLANS.forEach((p) => {
        const mine = planned.filter((c) => c.room.id === p.id).sort((a, b) => a.startMs - b.startMs);
        const dev: DeviceState = { water: p.meterStart.water, energy: p.meterStart.energy, t: firstStart - 7 * DAY_MS, relayOn: true, offlineUntil: 0, sample: null };

        mine.forEach((c, i) => {
            // Masa istirahat sebelum siklus ini.
            advanceDevice(dev, p.id, null, c.startMs);
            const baseline = { baseline_water_liter: round(dev.water, 1), baseline_energy_kwh: round(dev.energy, 3), baseline_captured_at: new Date(c.startMs).toISOString() };

            const ctx: CycleCtx = {
                startMs: c.startMs,
                endMs: c.endMs,
                populationAt: (t) => c.population * (1 - cumulativeMortality(ageAt(c.startMs, t))),
            };
            const until = c.endMs ?? now;
            advanceDevice(dev, p.id, ctx, until);

            const extra = read<CycleExtra>(`coasther_cycle_extra_${c.leaseId}`) ?? {};
            write(`coasther_cycle_extra_${c.leaseId}`, {
                ...extra,
                ...baseline,
                ...(c.endMs != null ? { end_water_liter: round(dev.water, 1), end_energy_kwh: round(dev.energy, 3) } : {}),
            });
            if (i === mine.length - 1 && c.endMs != null) advanceDevice(dev, p.id, null, now);
        });
        devices[p.id] = dev;
    });

    // Riwayat peringatan 7 hari & uji kalibrasi yang sudah dilakukan.
    const activeKandang = planned
        .filter((c) => c.endMs == null)
        .map((c) => ({ roomId: c.room.id, number: c.room.number, startMs: c.startMs, expectedKw: getExpectedPowerKw(read<RoomExtra>(`coasther_room_extra_${c.room.id}`) ?? {}) ?? 0.1 }));
    write("coasther_alert_log", seedAlertHistory(activeKandang, now));
    write("coasther_calibration", seedCalibrations(now));

    const meters: Meter[] = PLANS.flatMap((p, i) => (["water", "electricity"] as const).map((type, j) => ({
        id: i * 2 + j + 1,
        room_id: p.id,
        type,
        device_uid: `ESP32-${p.number}`,
        unit: type === "water" ? "m3" : "kwh",
        is_active: true,
        installed_at: "2026-03-01",
        created_at: "2026-03-01T08:00:00.000Z",
        updated_at: "2026-03-01T08:00:00.000Z",
        room_number: p.number,
        room_floor: p.floor,
    })));

    cachedDB = {
        version: DEMO_VERSION,
        rooms,
        leases,
        meters,
        tariff: {
            id: 1,
            water_rate: 2500,
            water_free_quota: 0,
            electricity_rate: 1444.7,
            electricity_free_quota: 0,
            late_fee_flat: 0,
            updated_at: "2026-03-01T08:00:00.000Z",
        },
        users: [DEMO_USER],
        seq: { room: rooms.length, lease: leases.length, meter: meters.length },
    };
    cachedSim = { devices };
    saveDB();
    saveSim();
}
