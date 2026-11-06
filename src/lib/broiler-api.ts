import { api } from "./api";

export type Source = "real" | "simulation";
export type User = { id: number; name: string; email: string; phone?: string; role: string; default_coop_id?: number | null };
export type Farm = { id: number; name: string; location_text?: string | null; owner_user_id?: number; member_role?: string; timezone: string; electricity_rate_idr_per_kwh: number; water_rate_idr_per_m3: number; is_active?: boolean | number };
export type Coop = { id: number; farm_id: number; code: string; name: string; member_role?: string; status: string; capacity_birds?: number | null; description?: string | null; timezone?: string };
export type Cycle = { id: number; coop_id: number; cycle_code: string; status: string; initial_population: number; current_population: number; day_age: number; placement_date: string; planned_harvest_date?: string | null; actual_harvest_date?: string | null; strain?: string | null; notes?: string | null };
export type Live = { source: string; status: string; recorded_at: string | null; flow_rate_lpm: number | null; water_total_liter: number | null; voltage_v: number | null; current_a: number | null; power_w: number | null; energy_kwh_total: number | null; frequency_hz: number | null; power_factor: number | null; field_status: Record<string, string> };
export type DailyMetric = { metric_date?: string; source?: string; status?: string; water_liters: number | null; energy_kwh: number | null; water_liters_per_bird?: number | null; energy_wh_per_bird?: number | null; electricity_cost_idr?: number | null; water_cost_idr?: number | null; population_basis?: number | null };
export type StreamSummary = { live: Live; today: DailyMetric | null; cycle_totals: DailyMetric | null };
export type Summary = StreamSummary & { local_date?: string; state: string; coop: Coop | null; farm?: Farm; active_cycle: Cycle | null; devices: { id: number; name: string; connectivity_status: string; last_seen_at: string | null }[]; generated_at?: string; data_status?: string; simulation?: StreamSummary };
export type ServerAlert = { id: number; coop_id: number; title: string; message: string; severity: string; status: string; source: string; detected_at: string; acknowledged_at?: string | null; resolved_at?: string | null; evidence_json?: unknown };

export async function readData<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await api.get<{ success: boolean; data: T }>(path, { params });
    return response.data.data;
}
export async function writeData<T = unknown>(method: "post" | "put" | "patch" | "delete", path: string, body?: unknown): Promise<T> {
    const response = await api.request<{ success: boolean; data: T }>({ method, url: path, data: body });
    return response.data.data;
}
export async function allPages<T>(path: string, field: string): Promise<T[]> {
    const result: T[] = [];
    for (let page = 1; ; page++) {
        const data = await readData<Record<string, T[]>>(path, { page, limit: 100 });
        const rows = data[field] ?? [];
        result.push(...rows);
        if (rows.length < 100) break;
    }
    return result;
}
export function stream(summary: Summary | undefined, source: Source): StreamSummary | undefined {
    return source === "simulation" ? summary?.simulation : summary;
}
export function metric(value: unknown, decimals = 1, suffix = ""): string {
    if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
    return `${Number(value).toLocaleString("id-ID", { maximumFractionDigits: decimals })}${suffix}`;
}
export const queryScope = (userId: number | undefined, farmId: number | undefined, coopId: number | undefined, source: Source, cycleId?: number) => ["broiler", userId, farmId, coopId, source, cycleId] as const;
export const wattsToKw = (value: number | null | undefined) => value == null ? null : value / 1000;
export const litersToM3 = (value: number | null | undefined) => value == null ? null : value / 1000;
export const kwhToWh = (value: number | null | undefined) => value == null ? null : value * 1000;

/** Chart-only null separator: never interpolate across an unobserved telemetry bucket. */
export function telemetryChartPoints<T extends { recorded_at: string }>(samples: T[], bucketSeconds: number) {
    const points: (T | { recorded_at: string; power_w: null; flow_rate_lpm: null })[] = [];
    const interval = bucketSeconds * 1000;
    for (const sample of samples) {
        const previous = points.at(-1);
        if (previous && Date.parse(sample.recorded_at) - Date.parse(previous.recorded_at) > interval) {
            points.push({ recorded_at: new Date(Date.parse(previous.recorded_at) + interval).toISOString(), power_w: null, flow_rate_lpm: null });
        }
        points.push(sample);
    }
    return points;
}
