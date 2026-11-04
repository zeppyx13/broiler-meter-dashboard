// Simulasi alat IoT (ESP32 + PZEM-004T + YF-S201) tiap kandang untuk mode demo.
//
// Angka dibuat dari model sederhana yang masuk akal untuk peternak broiler UMKM
// (kandang panggung/open house, ratusan ekor per kandang, listrik rumah tangga):
// - Air minum mengikuti kurva L/ekor/hari menurut hari umur × populasi, sedikit
//   naik di siang hari (panas) dan turun di dini hari.
// - Daya mengikuti peralatan yang menyala (bohlam brooder, LED, kipas dinding) dan relay.
// - Ada "kejadian" terjadwal supaya Guard punya sesuatu untuk ditangkap: kipas
//   mati sebentar di Kandang 1, tegangan turun di Kandang 3, dan konsumsi air
//   Kandang 2 sedikit di bawah pola.
// Meter bersifat kumulatif dan terus bertambah selama waktu berjalan — termasuk
// saat tab ditutup (dikejar ulang saat dibuka).

import type { LiveStatus } from "@/lib/live-status-api";
import { expectedWaterPerBirdLPerDay } from "@/lib/broiler-reference";
import { getCycleState, getRoomExtra, localDateKey, type Equipment } from "@/lib/broiler-local-store";
import type { Lease } from "@/types/lease";
import type { Room } from "@/types/room";

export const SAMPLE_MS = 5_000;
export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type DeviceState = {
    water: number; // liter kumulatif
    energy: number; // kWh kumulatif
    t: number; // waktu simulasi terakhir (ms)
    relayOn: boolean;
    offlineUntil: number; // reboot → tidak mengirim data sampai waktu ini
    sample: LiveStatus | null;
};

export type SimState = { devices: Record<string, DeviceState> };

/** Konteks siklus untuk menghitung kebutuhan air & daya. */
export type CycleCtx = {
    startMs: number;
    endMs: number | null;
    populationAt: (t: number) => number;
    /** Peralatan tersimpan (mode live). Kosong → pakai templat menurut umur. */
    equipment?: Equipment[];
};

// ── Bilangan acak yang deterministik ───────────────────────────────────────

export function noise(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1; // -1..1
}

export function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── Model biologis & peralatan ─────────────────────────────────────────────

export function ageAt(startMs: number, t: number) {
    return Math.max(0, Math.floor((t - startMs) / DAY_MS));
}

/** Perkiraan kematian kumulatif (fraksi) sampai hari umur tertentu. */
export function cumulativeMortality(age: number) {
    return 0.003 * Math.min(age, 7) + 0.0012 * Math.min(Math.max(age - 7, 0), 7) + 0.0011 * Math.max(age - 14, 0);
}

/** Bagian kipas yang perlu menyala: anak ayam belum butuh angin, mulai grower makin banyak. */
function fanShare(age: number) {
    if (age < 10) return 0;
    if (age < 18) return 0.5;
    return 1;
}

/**
 * Peralatan kandang panggung/open house skala UMKM (ratusan ekor):
 * - Bohlam pijar 100 W sebagai pemanas brooder, ±1 lampu per 200–250 ekor, s.d. hari ke-14.
 * - Lampu LED 10 W untuk penerangan, ±1 per 150 ekor.
 * - Kipas angin dinding ±45 W, ±1 per 300 ekor, dipakai mulai masa grower.
 * Air dari toren (gravitasi), jadi pompa sumur tidak ikut meter kandang.
 */
export function templateEquipment(population: number, age: number): Equipment[] {
    const fans = Math.max(1, Math.ceil(population / 300));
    const activeFans = Math.round(fans * fanShare(age));
    const list: Equipment[] = [];
    list.push({ id: "pemanas", type: "pemanas", name: "Bohlam pijar brooder 100 W", count: Math.max(1, Math.ceil(population / 225)), watt: 100, active: age <= 14 });
    list.push({ id: "lampu", type: "lampu", name: "Lampu LED", count: Math.max(2, Math.ceil(population / 150)), watt: 10, active: true });
    if (activeFans > 0) list.push({ id: "kipas-aktif", type: "kipas", name: "Kipas angin dinding", count: activeFans, watt: 45, active: true });
    if (fans > activeFans) list.push({ id: "kipas-cadangan", type: "kipas", name: "Kipas angin dinding (belum perlu)", count: fans - activeFans, watt: 45, active: false });
    return list;
}

function equipmentKw(list: Equipment[], relayOn: boolean) {
    return list
        .filter((e) => e.active && (relayOn || (e.type !== "lampu" && e.type !== "pemanas")))
        .reduce((sum, e) => sum + (e.count * e.watt) / 1000, 0);
}

// Kepribadian tiap kandang demo (selain itu: normal).
function profile(roomId: number) {
    return {
        waterFactor: roomId === 2 ? 0.86 : 1,
        // Beban campuran bohlam (resistif), LED & kipas kecil. A02 memakai LED murah → PF rendah.
        pf: roomId === 2 ? 0.8 : 0.9,
        phase: (roomId * 1.7) % (Math.PI * 2),
    };
}

function minuteOfDay(t: number) {
    const d = new Date(t);
    return d.getHours() * 60 + d.getMinutes();
}

/** Kandang 1: kipas mati / steker lepas ±18 menit setiap 4 jam. */
export function fanFailure(roomId: number, t: number) {
    const m = minuteOfDay(t) % 240;
    return roomId === 1 && m >= 100 && m < 118;
}

/** Kandang 3: tegangan PLN turun ±10 menit setiap 2 jam. */
export function voltageDip(roomId: number, t: number) {
    const m = minuteOfDay(t) % 120;
    return roomId === 3 && m >= 50 && m < 60;
}

export type Rates = { powerKw: number; flowLpm: number; voltage: number; pf: number; frequency: number };

export function ratesAt(roomId: number, t: number, ctx: CycleCtx | null, relayOn: boolean): Rates {
    const p = profile(roomId);
    const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
    const n = (k: number) => noise(roomId * 1_000_003 + Math.floor(t / SAMPLE_MS) * 7 + k);

    const voltage = voltageDip(roomId, t)
        ? 191 + n(1) * 1.5
        : 220 + 4 * Math.sin(((hour - 19) / 24) * Math.PI * 2 + p.phase) + n(1) * 1.2;
    const frequency = 50 + n(2) * 0.04;

    const active = ctx && t >= ctx.startMs && (ctx.endMs == null || t < ctx.endMs);
    if (!ctx || !active) {
        // Kandang kosong: satu lampu jaga; pagi hari dicuci & disemprot (persiapan siklus).
        const washing = hour >= 8 && hour < 9.5;
        return {
            powerKw: 0.01 + (washing ? 0.25 : 0) + n(3) * 0.002,
            flowLpm: washing ? 2.5 + n(4) * 0.3 : 0,
            voltage,
            pf: 0.78 + n(5) * 0.02,
            frequency,
        };
    }

    const age = ageAt(ctx.startMs, t);
    const population = ctx.populationAt(t);

    // Siang lebih panas → minum sedikit lebih banyak.
    const waterDiurnal = 1 + 0.08 * Math.sin(((hour - 8) / 24) * Math.PI * 2);
    const flowLpm = Math.max(0, ((expectedWaterPerBirdLPerDay(age) * population) / 1440) * p.waterFactor * waterDiurnal * (1 + n(6) * 0.03));

    const powerDiurnal = 0.96 + 0.04 * Math.sin(((hour - 8) / 24) * Math.PI * 2);
    const equipment = ctx.equipment && ctx.equipment.length > 0 ? ctx.equipment : templateEquipment(population, age);
    let powerKw = equipmentKw(equipment, relayOn) * 0.96 * powerDiurnal;
    if (fanFailure(roomId, t)) powerKw *= 0.62;
    powerKw = Math.max(0.005, powerKw * (1 + n(7) * 0.015));

    return { powerKw, flowLpm, voltage, pf: p.pf + n(8) * 0.01, frequency };
}

// ── Menjalankan waktu ──────────────────────────────────────────────────────

const BASELINE_PREFIX = "coasther_daily_baseline_";

function writeDailyBaseline(roomId: number, date: string, atMs: number, dev: DeviceState) {
    try {
        window.localStorage.setItem(
            `${BASELINE_PREFIX}${roomId}`,
            JSON.stringify({ date, at: new Date(atMs).toISOString(), waterLiter: dev.water, energyKwh: dev.energy })
        );
    } catch {
        // abaikan
    }
}

function startOfLocalDay(t: number) {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Majukan satu alat sampai `now`. Saat melewati tengah malam hari ini, angka
 * meter saat itu dicatat sebagai titik awal "pemakaian hari ini".
 */
export function advanceDevice(dev: DeviceState, roomId: number, ctx: CycleCtx | null, now: number, onStep?: (t: number) => void) {
    const today = localDateKey(new Date(now));
    while (dev.t < now) {
        const gap = now - dev.t;
        let dt = gap > 15 * 60_000 ? 10 * 60_000 : Math.min(gap, SAMPLE_MS);
        // Jangan melompati tengah malam — supaya titik awal harian tepat.
        const nextMidnight = startOfLocalDay(dev.t) + DAY_MS;
        if (dev.t + dt > nextMidnight && dev.t < nextMidnight) dt = nextMidnight - dev.t;

        const r = ratesAt(roomId, dev.t + dt / 2, ctx, dev.relayOn);
        dev.water += (r.flowLpm * dt) / 60_000;
        dev.energy += (r.powerKw * dt) / HOUR_MS;
        dev.t += dt;
        onStep?.(dev.t);

        if (dev.t === nextMidnight && localDateKey(new Date(dev.t)) === today) {
            writeDailyBaseline(roomId, today, dev.t, dev);
        }
    }
}

export function takeSample(dev: DeviceState, room: Room, ctx: CycleCtx | null, now: number): LiveStatus | null {
    if (now < dev.offlineUntil) return null;
    const sampleAt = Math.floor(now / SAMPLE_MS) * SAMPLE_MS;
    if (dev.sample && Date.parse(dev.sample.recorded_at) >= sampleAt) return null;

    const r = ratesAt(room.id, sampleAt, ctx, dev.relayOn);
    const powerW = r.powerKw * 1000;
    dev.sample = {
        room_id: room.id,
        number: room.number,
        flow_rate_lpm: round(r.flowLpm, 2),
        water_total_liter: round(dev.water, 1),
        voltage: round(r.voltage, 1),
        current: round(powerW / (r.voltage * r.pf), 2),
        power: round(powerW, 1),
        energy_kwh_total: round(dev.energy, 3),
        frequency: round(r.frequency, 2),
        pf: round(r.pf, 2),
        recorded_at: new Date(sampleAt).toISOString(),
    };
    return dev.sample;
}

export function round(v: number, digits: number) {
    const f = 10 ** digits;
    return Math.round(v * f) / f;
}

/** Konteks siklus berjalan dari data lokal (populasi sekarang & peralatan tersimpan). */
export function liveCycleCtx(room: Room, leases: Lease[]): CycleCtx | null {
    const lease = leases.find((l) => l.room_id === room.id && l.status === "active");
    if (!lease) return null;
    const state = getCycleState(lease.id, room.id);
    const population = state.populationNow ?? 0;
    return {
        startMs: Date.parse(lease.start_date),
        endMs: null,
        populationAt: () => population,
        equipment: getRoomExtra(room.id).equipment,
    };
}
