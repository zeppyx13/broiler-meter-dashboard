import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { PaymentListResponse } from "@/types/payment";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getPayments(params?: {
    status?: string;
    page?: number;
    limit?: number;
}) {
    const response = await api.get<PaymentListResponse>("/api/payments-admin", {
        params,
        headers: authHeader(),
    });
    return response.data.data;
}