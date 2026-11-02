export type Tenant = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: "tenant" | "admin" | "manager";
    created_at: string;
    updated_at: string;
    // dari findById (detail)
    lease_id?: number | null;
    lease_status?: string | null;
    lease_start?: string | null;
    lease_end?: string | null;
    room_number?: string | null;
    room_floor?: number | null;
};

export type TenantListResponse = {
    success: boolean;
    message: string;
    data: {
        users: Tenant[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    };
};

export type TenantFormPayload = {
    name?: string;
    phone?: string | null;
    role?: "tenant" | "admin" | "manager";
};