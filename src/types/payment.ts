export type Payment = {
    id: number;
    invoice_id: number;
    method: string;
    provider: string;
    provider_order_id: string;
    provider_transaction_id: string | null;
    status: "pending" | "paid" | "failed" | "expired" | "cancelled";
    amount: number;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
    invoice_month: string;
    invoice_total: number;
    tenant_name: string;
    tenant_email: string;
    room_number: string;
};

export type PaymentListResponse = {
    success: boolean;
    message: string;
    data: {
        payments: Payment[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    };
};