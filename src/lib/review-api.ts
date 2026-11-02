import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ReviewItem = {
    name: string;
    number: string;
    rating: number;
    comment: string | null;
    created_at: string;
};

export type RoomRatingSummary = {
    room_id: number;
    number: string;
    avg_rating: number | null;
    total_reviews: number;
};

export async function getAllReviews(): Promise<ReviewItem[]> {
    const response = await api.get("/api/reviews", {
        headers: authHeader(),
    });
    return response.data?.data?.reviews ?? [];
}

export async function getRoomsSummary(): Promise<RoomRatingSummary[]> {
    const response = await api.get("/api/reviews/summary", {
        headers: authHeader(),
    });
    return response.data?.data?.rooms ?? [];
}