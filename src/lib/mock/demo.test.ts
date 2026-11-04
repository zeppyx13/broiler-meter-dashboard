import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GUARD_SETTINGS } from "@/lib/guard-settings";
import { buildSnapshots } from "@/lib/kandang-snapshot";
import { summarizeCycle, monthlyEfficiency } from "@/lib/cycle-history";
import { localDateKey } from "@/lib/broiler-local-store";

// Jam 13:00 — di luar jendela kejadian kipas (Kandang 1) & tegangan (Kandang 3).
const NOW = new Date("2026-11-04T13:00:00");

function stubBrowser() {
    const store = new Map<string, string>();
    const storage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() {
            return store.size;
        },
    };
    vi.stubGlobal("window", { localStorage: storage, sessionStorage: storage, location: { origin: "http://localhost:3000" } });
}

beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    stubBrowser();
});

async function load() {
    const db = await import("./db");
    const runtime = await import("./runtime");
    return { db, runtime };
}

describe("data demo", () => {
    it("membuat 4 kandang: 3 siklus berjalan, 1 istirahat, dengan riwayat", async () => {
        const { db } = await load();
        const data = db.getDB();
        expect(data.rooms).toHaveLength(4);
        expect(data.leases.filter((l) => l.status === "active")).toHaveLength(3);
        expect(data.leases.filter((l) => l.status === "ended").length).toBeGreaterThanOrEqual(8);
    });

    it("telemetri masuk akal dan Guard menangkap air Kandang A02", async () => {
        const { db, runtime } = await load();
        const live = runtime.liveStatusList();
        expect(live).toHaveLength(4);

        // Skala UMKM: 600 ekor hari ke-23 → LED + 2 kipas dinding, ±130 W; air ±0,09 L/menit.
        const a01 = live.find((l) => l.room_id === 1)!;
        expect(a01.power).toBeGreaterThan(80);
        expect(a01.power).toBeLessThan(250);
        expect(a01.flow_rate_lpm).toBeGreaterThan(0.05);
        expect(a01.voltage).toBeGreaterThan(205);
        // Semua kandang muat di listrik rumah tangga 1.300 VA.
        expect(live.reduce((s, l) => s + l.power, 0)).toBeLessThan(1100);

        const data = db.getDB();
        const snaps = buildSnapshots(data.rooms, data.leases.filter((l) => l.status === "active"), live, DEFAULT_GUARD_SETTINGS);
        const byNumber = Object.fromEntries(snaps.map((s) => [s.room.number, s]));

        expect(byNumber.A01.insights.alerts.filter((a) => a.tier !== "info")).toEqual([]);
        expect(byNumber.B01.insights.alerts.filter((a) => a.tier !== "info")).toEqual([]);
        expect(byNumber.A02.insights.alerts.map((a) => `${a.id}:${a.tier}`)).toContain("water:waspada");
        expect(byNumber.B02.cycle).toBeNull();
    });

    it("meter terus bertambah seiring waktu", async () => {
        const { runtime } = await load();
        const before = runtime.liveStatusList().find((l) => l.room_id === 1)!;
        vi.setSystemTime(new Date(NOW.getTime() + 10 * 60_000));
        const after = runtime.liveStatusList().find((l) => l.room_id === 1)!;
        expect(after.water_total_liter).toBeGreaterThan(before.water_total_liter);
        expect(after.energy_kwh_total).toBeGreaterThan(before.energy_kwh_total);
        expect(after.recorded_at).not.toBe(before.recorded_at);
    });

    it("kejadian terjadwal: kipas Kandang A01 trip → Guard kritis", async () => {
        const { db, runtime } = await load();
        runtime.liveStatusList();
        vi.setSystemTime(new Date("2026-11-04T13:45:00")); // menit 825 % 240 = 105
        const live = runtime.liveStatusList();
        const data = db.getDB();
        const snaps = buildSnapshots(data.rooms, data.leases.filter((l) => l.status === "active"), live, DEFAULT_GUARD_SETTINGS);
        expect(snaps.find((s) => s.room.id === 1)!.insights.alerts.map((a) => `${a.id}:${a.tier}`)).toContain("power:kritis");
    });

    it("riwayat siklus punya FCR, IP, dan konsumsi yang wajar", async () => {
        const { db } = await load();
        const data = db.getDB();
        const today = localDateKey();
        const ended = data.leases.filter((l) => l.status === "ended").map((l) => summarizeCycle(l, { today, electricityRate: data.tariff.electricity_rate }));
        ended.forEach((s) => {
            expect(s.fcr!).toBeGreaterThan(1.35);
            expect(s.fcr!).toBeLessThan(1.8);
            expect(s.ip!).toBeGreaterThan(280);
            expect(s.ip!).toBeLessThan(450);
            expect(s.depletionPct!).toBeGreaterThan(2);
            expect(s.depletionPct!).toBeLessThan(8);
            expect(s.waterPerBirdL!).toBeGreaterThan(4);
            expect(s.waterPerBirdL!).toBeLessThan(9);
            // Brooding pakai bohlam listrik: ±0,2–0,5 kWh/ekor (≈ Rp 300–700/ekor).
            expect(s.kwhPerBird!).toBeGreaterThan(0.15);
            expect(s.kwhPerBird!).toBeLessThan(0.6);
        });
        const months = monthlyEfficiency(ended, { today, months: 6, electricityRate: data.tariff.electricity_rate });
        expect(months.filter((m) => m.energyKwh > 0).length).toBeGreaterThanOrEqual(3);
    });

    it("perintah relay & reboot dijalankan oleh alat", async () => {
        const { runtime } = await load();
        runtime.liveStatusList();
        expect(runtime.runDeviceCommand(3, "relay_off")).toMatch(/relay_off/);
        expect(runtime.relayState(3)).toBe(false);
        runtime.runDeviceCommand(3, "reboot");
        expect(() => runtime.runDeviceCommand(3, "status")).toThrow(/restart/);
    });
});
