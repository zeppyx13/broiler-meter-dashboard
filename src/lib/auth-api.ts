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
    const { data } = await api.post<LoginResponse>("/api/auth/login", { email: payload.email, password: payload.password });
    return data.data; // langsung return { token, user }
}

export type RegisterPayload = {
    name: string;
    email: string;
    password: string;
    phone?: string;
};

export async function register(payload: RegisterPayload): Promise<void> {
    // Explicitly allow only public registration fields; never forward form extras.
    const { status, data } = await api.post<{
        success: boolean;
        data?: { user?: User };
    }>("/api/auth/register", {
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        ...(payload.phone?.trim() ? { phone: payload.phone.trim() } : {}),
    });

    if (status !== 201 || data?.success !== true || data.data?.user?.id == null) {
        throw new Error("Pendaftaran belum dapat dikonfirmasi. Coba masuk sebelum mendaftar lagi.");
    }
    // Registration may return a token. Do not store it or start a session.
}
