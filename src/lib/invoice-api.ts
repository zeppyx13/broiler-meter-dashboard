import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { InvoiceListResponse, InvoiceUpdatePayload } from "@/types/invoice";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getInvoices(params?: {
    status?: string;
    month?: string;
    page?: number;
    limit?: number;
}) {
    const response = await api.get<InvoiceListResponse>("/api/invoices", {
        params,
        headers: authHeader(),
    });
    return response.data.data;
}

export async function updateInvoice(id: number, payload: InvoiceUpdatePayload) {
    const response = await api.patch(`/api/invoices/${id}`, payload, {
        headers: authHeader(),
    });
    return response.data;
}