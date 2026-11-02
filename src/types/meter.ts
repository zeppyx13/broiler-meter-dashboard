export type Meter = {
    id: number;
    room_id: number;
    type: "water" | "electricity";
    device_uid: string;
    unit: "m3" | "kwh";
    is_active: boolean | number;
    installed_at: string | null;
    created_at: string;
    updated_at: string;
    room_number: string;
    room_floor: number;
};

export type MeterListResponse = {
    success: boolean;
    message: string;
    data: {
        meters: Meter[];
    };
};

export type MeterFormPayload = {
    room_id: number;
    type: "water" | "electricity";
    device_uid: string;
    unit: "m3" | "kwh";
    is_active?: boolean;
    installed_at?: string | null;
};

export type MeterUpdatePayload = {
    device_uid?: string;
    unit?: "m3" | "kwh";
    is_active?: boolean;
    installed_at?: string | null;
};