import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type LiveStatus = {
    room_id: number;
    number?: string;
    flow_rate_lpm: number | null;
    water_total_liter: number | null;
    voltage: number | null;
    current: number | null;
    power: number | null;
    energy_kwh_total: number | null;
    frequency: number | null;
    pf: number | null;
    recorded_at: string;
};

export async function getAllLiveStatus(): Promise<LiveStatus[]> {
    const token = getToken();
    const response = await api.get("/api/iot/live-status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data.data ?? [];
}
