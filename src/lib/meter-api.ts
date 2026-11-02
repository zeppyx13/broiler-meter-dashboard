import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { MeterListResponse, MeterFormPayload, MeterUpdatePayload } from "@/types/meter";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getMeters(params?: {
    room_id?: number;
    type?: "water" | "electricity";
    is_active?: number;
}) {
    const response = await api.get<MeterListResponse>("/api/meters", {
        params,
        headers: authHeader(),
    });
    return response.data.data;
}

export async function createMeter(payload: MeterFormPayload) {
    const response = await api.post("/api/meters", payload, {
        headers: authHeader(),
    });
    return response.data;
}

export async function updateMeter(id: number, payload: MeterUpdatePayload) {
    const response = await api.patch(`/api/meters/${id}`, payload, {
        headers: authHeader(),
    });
    return response.data;
}

export async function deleteMeter(id: number) {
    const response = await api.delete(`/api/meters/${id}`, {
        headers: authHeader(),
    });
    return response.data;
}