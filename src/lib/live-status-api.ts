import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type LiveStatus = {
    room_id: number;
    number?: string;
    flow_rate_lpm: number;
    water_total_liter: number;
    voltage: number;
    current: number;
    power: number;
    energy_kwh_total: number;
    frequency: number;
    pf: number;
    recorded_at: string;
};

export async function getAllLiveStatus(): Promise<LiveStatus[]> {
    const token = getToken();
    const response = await api.get("/api/iot/live-status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data.data ?? [];
}
