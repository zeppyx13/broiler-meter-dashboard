import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
    timestamp?: string;
};

export async function sendAdminChat(question: string, history: ChatMessage[]) {
    const response = await api.post(
        "/api/ai/admin-chat",
        {
            question,
            history: history.map((m) => ({ role: m.role, content: m.content })),
        },
        { headers: authHeader() }
    );
    return response.data.data;
}