export type Complaint = {
    id: number;
    room_id: number;
    user_id?: number;
    title: string;
    status: "open" | "in_progress" | "closed";
    created_at: string;
    closed_at: string | null;
    room_number: string;
    room_floor: number;
    tenant_name?: string;
    tenant_email?: string;
    description?: string | null;
};

export type ComplaintListResponse = {
    success: boolean;
    message: string;
    data: {
        complaints: Complaint[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    };
};