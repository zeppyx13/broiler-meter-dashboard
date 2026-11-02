import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { LeaseListResponse, LeaseFormPayload, LeaseUpdatePayload } from "@/types/lease";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getLeases(params?: {
    status?: string;
    page?: number;
    limit?: number;
}) {
    const response = await api.get<LeaseListResponse>("/api/leases", {
        params,
        headers: authHeader(),
    });
    return response.data.data;
}

export async function createLease(payload: LeaseFormPayload) {
    const response = await api.post("/api/leases", payload, {
        headers: authHeader(),
    });
    return response.data;
}

export async function updateLease(id: number, payload: LeaseUpdatePayload) {
    const response = await api.patch(`/api/leases/${id}`, payload, {
        headers: authHeader(),
    });
    return response.data;
}

export async function deleteLease(id: number) {
    const response = await api.delete(`/api/leases/${id}`, {
        headers: authHeader(),
    });
    return response.data;
}