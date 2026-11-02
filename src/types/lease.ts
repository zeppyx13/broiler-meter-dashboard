export type Lease = {
    id: number;
    user_id: number;
    room_id: number;
    start_date: string;
    end_date: string | null;
    status: "active" | "ended";
    monthly_rent_snapshot: number;
    note: string | null;
    created_at: string;
    updated_at: string;
    tenant_name: string;
    tenant_email: string;
    room_number: string;
    room_floor: number;
};

export type LeaseListResponse = {
    success: boolean;
    message: string;
    data: {
        leases: Lease[];
        meta: { total: number; page: number; limit: number };
    };
};

export type LeaseFormPayload = {
    user_id: number;
    room_id: number;
    start_date: string;
    end_date?: string | null;
    monthly_rent_snapshot: number;
    note?: string | null;
};

export type LeaseUpdatePayload = {
    end_date?: string | null;
    status?: "active" | "ended";
    monthly_rent_snapshot?: number;
    note?: string | null;
};