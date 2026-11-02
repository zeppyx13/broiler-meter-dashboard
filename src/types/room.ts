export type Room = {
    id: number;
    number: string;
    floor: number | null;
    price_monthly: number;
    deposit: number;
    is_available: boolean | number;
    description: string | null;
    main_image_url: string | null;
    is_occupied: boolean | number;
    created_at: string;
    updated_at: string;
    facilities?: { id: number; name: string }[];
    review_avg?: number;
    review_count?: number;
};
export type RoomWithFacilities = Room & {
    facilities: { id: number; name: string }[];
};

export type RoomListResponse = {
    success: boolean;
    message: string;
    data: {
        rooms: Room[];
        meta: {
            total: number;
            page: number;
            limit: number;
        };
    };
};

export type RoomDetailResponse = {
    success: boolean;
    message: string;
    data: {
        room: RoomWithFacilities;
    };
};

export type RoomFormPayload = {
    number: string;
    floor?: number | null;
    price_monthly: number;
    deposit?: number;
    is_available?: boolean;
    description?: string | null;
    main_image_url?: string | null;
    facility_ids?: number[];
};