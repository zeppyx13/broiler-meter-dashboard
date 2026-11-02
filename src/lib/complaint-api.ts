import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { ComplaintListResponse } from "@/types/complaint";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getComplaints(params?: {
    status?: string;
    page?: number;
    limit?: number;
}) {
    const response = await api.get<ComplaintListResponse>(
        "/api/complaints/admin/complaints",
        { params, headers: authHeader() }
    );
    return response.data.data;
}

export async function updateComplaintStatus(id: number, status: "open" | "in_progress" | "closed") {
    const response = await api.patch(
        `/api/complaints/admin/complaints/${id}`,
        { status },
        { headers: authHeader() }
    );
    return response.data;
}