// Menerjemahkan data backend Broiler (farm, coop, flock cycle, summary, alert) ke bentuk
// yang dipakai komponen UI lama, supaya tampilan tetap sama sementara sumber datanya server.

import type { Room } from "@/types/room";
import type { Lease } from "@/types/lease";
import type { LiveStatus } from "@/lib/live-status-api";
import type { Tariff } from "@/lib/tariff-api";
import type { DailyRecord, Equipment, EquipmentType, TodayUsage } from "@/lib/broiler-local-store";
import type { AlertTier, KandangAlert } from "@/lib/kandang-insights";
import type { LoggedAlert } from "@/lib/alert-log";
import type { Coop, Cycle, DailyMetric, Farm, Live, ServerAlert } from "@/lib/broiler-api";

const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

// ── Kandang & siklus ───────────────────────────────────────────────────────

/** Coop backend → Room lama: `number` = kode kandang, `floor` = id lahan. */
export function coopToRoom(coop: Coop): Room {
    return {
        id: coop.id,
        number: coop.code,
        floor: coop.farm_id,
        price_monthly: 0,
        deposit: 0,
        is_available: coop.status === "active",
        description: coop.description ?? null,
        main_image_url: null,
        is_occupied: false,
        created_at: "",
        updated_at: "",
        population: coop.capacity_birds ?? undefined,
    };
}

/** Flock cycle backend → Lease lama (start_date = chick-in, end_date = panen). */
export function cycleToLease(cycle: Cycle): Lease {
    return {
        id: cycle.id,
        user_id: 0,
        room_id: cycle.coop_id,
        start_date: cycle.placement_date,
        end_date: cycle.actual_harvest_date ?? null,
        status: cycle.status === "active" ? "active" : "ended",
        monthly_rent_snapshot: 0,
        note: cycle.notes ?? null,
        created_at: "",
        updated_at: "",
        tenant_name: "",
        tenant_email: "",
        room_number: "",
        room_floor: 0,
    };
}

// ── Telemetri ──────────────────────────────────────────────────────────────

/** Status live dari server; nilai null (stale/no_data) tidak diubah jadi angka palsu. */
export function isLiveOnline(live: Live | null | undefined): boolean {
    return live?.source !== "simulation" && (live?.status === "live" || live?.status === "ok" || live?.status === "fresh");
}

/** Preserve every server null; one available field does not validate the other metrics. */
export function liveToLegacy(live: Live | null | undefined, coop: { id: number; code?: string }): LiveStatus | undefined {
    if (!live || !live.recorded_at) return undefined;
    return {
        room_id: coop.id,
        number: coop.code,
        flow_rate_lpm: num(live.flow_rate_lpm),
        water_total_liter: num(live.water_total_liter),
        voltage: num(live.voltage_v),
        current: num(live.current_a),
        power: num(live.power_w),
        energy_kwh_total: num(live.energy_kwh_total),
        frequency: num(live.frequency_hz),
        pf: num(live.power_factor),
        recorded_at: live.recorded_at,
    };
}

/** Konsumsi hari ini dari summary.today (hanya interval yang diterima server). */
export function todayFromMetric(today: DailyMetric | null | undefined): TodayUsage {
    const water = num(today?.water_liters);
    const energy = num(today?.energy_kwh);
    const ready = water != null || energy != null;
    const date = today?.metric_date;
    return {
        waterTodayLiter: water,
        energyTodayKwh: energy,
        since: ready && date ? new Date(`${date}T00:00:00`) : null,
        ready,
    };
}

/** Konsumsi siklus berjalan dari summary.cycle_totals. */
export function cycleUsageFromMetric(totals: DailyMetric | null | undefined, cycle: Cycle | null | undefined) {
    const water = num(totals?.water_liters);
    const energy = num(totals?.energy_kwh);
    if (!cycle || (water == null && energy == null)) return null;
    const since = new Date(`${cycle.placement_date}T00:00:00`);
    return {
        waterLiter: water,
        energyKwh: energy,
        since,
        elapsedDays: Math.max(0, cycle.day_age),
    };
}

/** Tarif lahan → Tariff lama (Rp/kWh dan Rp/m³). */
export function farmToTariff(farm: Partial<Farm> | null | undefined): Tariff | undefined {
    if (!farm) return undefined;
    const electricityRate = num(farm.electricity_rate_idr_per_kwh);
    const waterRate = num(farm.water_rate_idr_per_m3);
    if (electricityRate == null || waterRate == null) return undefined;
    return {
        id: farm.id ?? 0,
        electricity_rate: electricityRate,
        water_rate: waterRate,
        electricity_free_quota: 0,
        water_free_quota: 0,
        late_fee_flat: 0,
        updated_at: "",
    };
}

// ── Catatan harian & peralatan ─────────────────────────────────────────────

export type ServerDailyRecord = {
    id: number;
    record_date?: string;
    date?: string;
    dead: number;
    culled: number;
    avg_weight_g: number | null;
    feed_kg: number | null;
    note: string | null;
    revision: number;
    is_void?: boolean;
};

export function recordDate(r: ServerDailyRecord): string {
    return String(r.date ?? r.record_date ?? "").slice(0, 10);
}

export function recordToLegacy(r: ServerDailyRecord): DailyRecord {
    return {
        date: recordDate(r),
        dead: Number(r.dead) || 0,
        culled: Number(r.culled) || 0,
        avg_weight_g: num(r.avg_weight_g) ?? undefined,
        feed_kg: num(r.feed_kg) ?? undefined,
        note: r.note ?? undefined,
    };
}

export type ServerEquipment = {
    id: number;
    name: string;
    type: string;
    count: number;
    rated_watt: number | string;
    is_expected_active: boolean | number;
    is_active?: boolean | number;
    unit?: string;
    schedule?: { start: string; end: string } | null;
};

const EQUIPMENT_TO_LOCAL: Record<string, EquipmentType> = { fan: "kipas", light: "lampu", heater: "pemanas", brooder: "pemanas", pump: "pompa", other: "lainnya" };
const EQUIPMENT_TO_SERVER: Record<EquipmentType, string> = { kipas: "fan", lampu: "light", pemanas: "brooder", pompa: "pump", lainnya: "other" };

export function equipmentToLegacy(e: ServerEquipment): Equipment {
    return {
        id: String(e.id),
        type: EQUIPMENT_TO_LOCAL[e.type] ?? "lainnya",
        name: e.name,
        count: Number(e.count) || 0,
        watt: num(e.rated_watt) ?? 0,
        active: Boolean(Number(e.is_expected_active)),
        serverType: e.type,
        unit: e.unit,
        schedule: e.schedule ?? null,
    };
}

export function equipmentToServer(e: Equipment) {
    return {
        name: e.name?.trim() || e.type,
        type: e.serverType && EQUIPMENT_TO_LOCAL[e.serverType] === e.type ? e.serverType : EQUIPMENT_TO_SERVER[e.type] ?? "other",
        count: e.count,
        rated_watt: e.watt,
        is_expected_active: e.active,
        unit: e.unit ?? "unit",
        schedule: e.schedule ?? null,
    };
}

// ── Guard ──────────────────────────────────────────────────────────────────

export function severityToTier(severity: string): AlertTier {
    if (severity === "critical") return "kritis";
    if (severity === "warning") return "waspada";
    return "info";
}

/** Langkah pemeriksaan per aturan Guard server. */
const GUARD_ACTIONS: Record<string, string> = {
    device_offline: "Cek listrik di panel kandang dan koneksi internet perangkat. Pastikan kipas tetap menyala.",
    suspected_power_anomaly: "Daya panel tidak sesuai peralatan yang seharusnya menyala. Periksa kipas satu per satu dan belt-nya.",
    suspected_water_anomaly: "Air inlet menyimpang dari pola. Cek tekanan regulator, sumbatan nipple, dan kebocoran pipa.",
    no_water_flow: "Tidak ada aliran air ke tandon. Cek pompa, keran utama, dan pelampung tandon.",
    voltage_abnormal: "Pantau kipas dan pompa. Tegangan tidak stabil bisa merusak motor.",
    low_power_factor: "Periksa beban motor kipas/pompa; pertimbangkan kapasitor bank agar listrik lebih efisien.",
    cycle_overdue: "Bila ayam sudah dipanen, tutup siklus di halaman kandang.",
    daily_record_missing: "Catat ayam mati dan afkir agar populasi dan konsumsi per ekor tetap akurat.",
};

type AlertWithType = ServerAlert & { alert_type?: string };

export function serverAlertToKandang(a: AlertWithType): KandangAlert {
    return {
        id: a.alert_type ?? String(a.id),
        tier: severityToTier(a.severity),
        title: a.title,
        detail: a.message,
        action: GUARD_ACTIONS[a.alert_type ?? ""] ?? "Periksa kondisi kandang dan perangkat.",
    };
}

/** Alert server → entri riwayat Peringatan lama. */
export function serverAlertToLogged(a: AlertWithType, coopCode: string): LoggedAlert {
    return {
        key: `${a.coop_id}:${a.id}`,
        roomId: a.coop_id,
        roomNumber: coopCode,
        alertId: a.alert_type ?? String(a.id),
        tier: severityToTier(a.severity),
        title: a.title,
        detail: a.message,
        action: GUARD_ACTIONS[a.alert_type ?? ""] ?? "Periksa kondisi kandang dan perangkat.",
        firstSeen: a.detected_at,
        lastSeen: a.resolved_at ?? a.acknowledged_at ?? a.detected_at,
        resolvedAt: a.status === "resolved" ? (a.resolved_at ?? a.detected_at) : undefined,
        acknowledgedAt: a.acknowledged_at ?? undefined,
        serverId: a.id,
    };
}
