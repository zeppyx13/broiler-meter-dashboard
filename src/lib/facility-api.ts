import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { FacilityListResponse } from "@/types/facility";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getFacilities() {
    const response = await api.get<FacilityListResponse>("/api/facilities");
    return response.data.data;
}

export async function createFacility(name: string) {
    const response = await api.post("/api/facilities", { name }, {
        headers: authHeader(),
    });
    return response.data;
}

export async function updateFacility(id: number, name: string) {
    const response = await api.patch(`/api/facilities/${id}`, { name }, {
        headers: authHeader(),
    });
    return response.data;
}

export async function deleteFacility(id: number) {
    const response = await api.delete(`/api/facilities/${id}`, {
        headers: authHeader(),
    });
    return response.data;
}