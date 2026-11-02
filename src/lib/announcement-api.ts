import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { AnnouncementListResponse, AnnouncementFormPayload } from "@/types/announcement";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getAnnouncements(params?: {
    is_active?: number;
    page?: number;
    limit?: number;
}) {
    const response = await api.get<AnnouncementListResponse>("/api/announcements", {
        params,
        headers: authHeader(),
    });
    return response.data.data;
}

export async function createAnnouncement(payload: AnnouncementFormPayload) {
    const response = await api.post("/api/announcements", payload, {
        headers: authHeader(),
    });
    return response.data;
}

export async function updateAnnouncement(id: number, payload: Partial<AnnouncementFormPayload>) {
    const response = await api.patch(`/api/announcements/${id}`, payload, {
        headers: authHeader(),
    });
    return response.data;
}

export async function deleteAnnouncement(id: number) {
    const response = await api.delete(`/api/announcements/${id}`, {
        headers: authHeader(),
    });
    return response.data;
}