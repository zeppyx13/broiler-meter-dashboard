export type Announcement = {
    id: number;
    title: string;
    body: string;
    is_active: boolean | number;
    start_at: string | null;
    end_at: string | null;
    created_at: string;
};

export type AnnouncementListResponse = {
    success: boolean;
    message: string;
    data: {
        announcements: Announcement[];
        meta: { total: number; page: number; limit: number };
    };
};

export type AnnouncementFormPayload = {
    title: string;
    body: string;
    is_active?: boolean;
    start_at?: string | null;
    end_at?: string | null;
};