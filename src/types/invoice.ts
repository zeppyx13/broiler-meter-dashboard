export type Invoice = {
    id: number;
    lease_id: number;
    room_id: number;
    user_id: number;
    month: string;
    due_date: string;
    rent_amount: number;
    water_used: number;
    water_cost: number;
    elec_used: number;
    elec_cost: number;
    fine_amount: number;
    discount_percent: number;
    discount_amount: number;
    total_amount: number;
    status: "unpaid" | "paid" | "overdue";
    created_at: string;
    updated_at: string;
    tenant_name: string;
    tenant_email: string;
    room_number: string;
    room_floor: number;
};

export type InvoiceListResponse = {
    success: boolean;
    message: string;
    data: {
        invoices: Invoice[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    };
};

export type InvoiceUpdatePayload = {
    status?: "unpaid" | "paid" | "overdue";
    fine_amount?: number;
    discount_percent?: number;
    discount_amount?: number;
    total_amount?: number;
    due_date?: string;
};