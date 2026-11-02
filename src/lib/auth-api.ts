import { api } from "@/lib/api";

type User = {
    id: number | string;
    name: string;
    email: string;
    role: string;
};

type LoginResponse = {
    success: boolean;
    message: string;
    data: {
        token: string;
        user: User;
    };
};

export async function login(payload: {
    email: string;
    password: string;
    rememberMe?: boolean;
}) {
    const { data } = await api.post<LoginResponse>("/api/auth/login", payload);
    return data.data; // langsung return { token, user }
}