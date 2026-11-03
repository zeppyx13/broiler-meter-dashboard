import { api } from "@/lib/api";
import type { DashboardStatsResponse, DashboardChartResponse, DashboardSummaryResponse } from "@/types/dashboard-api";

export async function getDashboardStats() {
    const response = await api.get<DashboardStatsResponse>("/api/dashboard/stats");
    return response.data.data;
}

export async function getRoomsDashboard() {
    const response = await api.get("/api/rooms/dashboard/data");
    return response.data;
}

export async function getDashboardChart(months = 8) {
    const response = await api.get<DashboardChartResponse>("/api/dashboard/chart", {
        params: { months },
    });
    return response.data;
}

export async function getDashboardSummary() {
    const response = await api.get<DashboardSummaryResponse>("/api/dashboard/summary");
    return response.data.data;
}