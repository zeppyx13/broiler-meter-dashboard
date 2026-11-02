import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { TenantListResponse, TenantFormPayload } from "@/types/tenant";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getTenants(params?: {
    search?: string;
    role?: "tenant" | "admin" | "manager";
    page?: number;
    limit?: number;
}) {
    const response = await api.get<TenantListResponse>("/api/users-admin", {
        params,
        headers: authHeader(),
    });
    return response.data.data;
}

export async function updateTenant(id: number, payload: TenantFormPayload) {
    const response = await api.patch(`/api/users-admin/${id}`, payload, {
        headers: authHeader(),
    });
    return response.data;
}

export async function deleteTenant(id: number) {
    const response = await api.delete(`/api/users-admin/${id}`, {
        headers: authHeader(),
    });
    return response.data;
}